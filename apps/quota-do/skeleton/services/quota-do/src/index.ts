
export interface Env {
  BILLING_DB: D1Database;
  PLANS_KV: KVNamespace;
  QUOTA_DO: DurableObjectNamespace;
  MINUTE_WINDOW_SECONDS?: string;
}

type Meter =
  | "tool_call"
  | "messenger_envelope"
  | "rtc_min"
  | "egress_bytes"
  | "storage_bytes_month"
  | "encode_min";

type BucketConfig = {
  rate_per_min?: number; // for request-bound
  burst?: number;
  daily_cap?: number;
  monthly_quota?: number; // for batch-bound
};

type Limits = Record<Meter, BucketConfig>;

type Plan = {
  plan_id: string;
  buckets: Limits;
};

type CheckReq = {
  tenant_id: string;
  meter: Meter;
  qty?: number;
  op_key?: string; // for idempotency
};

type CheckResp =
  | { ok: true; cached?: boolean }
  | { ok: false; token: "BACKPRESSURE" | "RATE_LIMIT"; retry_after_ms?: number; remediation: string[] };

// Durable state structure
type MinuteState = { windowStart: number; tokens: number };
type DayState = { dayKey: string; used: number };

type MeterState = {
  minute?: MinuteState;
  day?: DayState;
  idem?: Record<string, boolean>;
};

export class QuotaDO {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "POST" && path.endsWith("/quota/check_and_consume")) {
        const body = (await request.json()) as CheckReq;
        const res = await this.checkAndConsume(body);
        return new Response(JSON.stringify(res), {
          headers: { "content-type": "application/json" },
        });
      }

      if (request.method === "GET" && path.endsWith("/admin/quota/snapshot")) {
        const tenant_id = url.searchParams.get("tenant_id") || "demo";
        const snapshot = await this.snapshot(tenant_id);
        return new Response(JSON.stringify(snapshot), {
          headers: { "content-type": "application/json" },
        });
      }

      if (request.method === "GET" && path.match(/\/plans\/[^/]+$/)) {
        const planId = path.split("/").pop()!;
        const plan = await this.getPlan(planId);
        return new Response(JSON.stringify(plan), { headers: { "content-type": "application/json" } });
      }

      if (request.method === "GET" && path.match(/\/tenants\/[^/]+\/plan$/)) {
        const tenantId = path.split("/")[3];
        const planId = await this.env.PLANS_KV.get(`tenant/${tenantId}/plan_id`);
        if (!planId) return new Response(JSON.stringify({ plan_id: "free" }), { headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify({ plan_id: planId }), { headers: { "content-type": "application/json" } });
      }

      return new Response("Not Found", { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, token: "INTERNAL", remediation: ["Retry later"] }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  private async getPlan(planId: string): Promise<Plan> {
    const raw = await this.env.PLANS_KV.get(`plans/${planId}`);
    if (raw) return JSON.parse(raw);
    // fallback free
    const free = await this.env.PLANS_KV.get("plans/free");
    if (free) return JSON.parse(free);
    // hard fallback minimal
    return {
      plan_id: "free",
      buckets: {
        tool_call: { rate_per_min: 30, burst: 60, daily_cap: 600 },
        messenger_envelope: { rate_per_min: 60, burst: 120, daily_cap: 2000 },
        rtc_min: { monthly_quota: 500 },
        egress_bytes: { monthly_quota: 10_000_000_000 },
        storage_bytes_month: { monthly_quota: 2_000_000_000 },
        encode_min: { monthly_quota: 50 },
      },
    };
  }

  private async effectiveLimits(tenant_id: string): Promise<Limits> {
    const planId = (await this.env.PLANS_KV.get(`tenant/${tenant_id}/plan_id`)) || "free";
    const plan = await this.getPlan(planId);
    // Optional per-tenant overrides:
    const overridesRaw = await this.env.PLANS_KV.get(`limits/${tenant_id}`);
    if (overridesRaw) {
      const overrides = JSON.parse(overridesRaw);
      return { ...plan.buckets, ...overrides };
    }
    return plan.buckets;
  }

  private minuteWindowSeconds(): number {
    const s = parseInt(this.env.MINUTE_WINDOW_SECONDS || "60", 10);
    return Number.isFinite(s) && s > 0 ? s : 60;
  }

  private dayKey(now: Date): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }

  private async loadMeterState(tenant_id: string, meter: Meter): Promise<MeterState> {
    const key = `meter:${tenant_id}:${meter}`;
    const raw = await this.state.storage.get<MeterState>(key);
    return raw || { minute: undefined, day: undefined, idem: {} };
    }

  private async saveMeterState(tenant_id: string, meter: Meter, st: MeterState) {
    const key = `meter:${tenant_id}:${meter}`;
    await this.state.storage.put(key, st);
  }

  private refill(minute: MinuteState, cfg: BucketConfig, nowSec: number): MinuteState {
    const window = this.minuteWindowSeconds();
    if (!cfg.rate_per_min || !cfg.burst) return minute;
    const curWindowStart = Math.floor(nowSec / window) * window;
    if (!minute.windowStart || minute.windowStart !== curWindowStart) {
      // refill tokens to rate, capped by burst
      const tokens = Math.min(cfg.rate_per_min, cfg.burst);
      return { windowStart: curWindowStart, tokens };
    }
    return minute;
  }

  private rateLimitResponse(retry_after_ms?: number) {
    return {
      ok: false,
      token: retry_after_ms !== undefined ? "BACKPRESSURE" : "RATE_LIMIT",
      retry_after_ms,
      remediation: retry_after_ms !== undefined
        ? ["Reduce call cadence", "Retry after retry_after_ms", "Upgrade plan if needed"]
        : ["Daily cap reached", "Try later", "Upgrade plan or add credits"]
    };
  }

  private async checkAndConsume(body: CheckReq): Promise<CheckResp> {
    const qty = body.qty ?? 1;
    const tenant = body.tenant_id;
    const meter = body.meter;

    const limits = await this.effectiveLimits(tenant);
    const cfg = limits[meter] || {};

    // idempotency: if op_key already consumed, accept without decrement
    const st = await this.loadMeterState(tenant, meter);
    if (body.op_key && st.idem && st.idem[body.op_key]) {
      return { ok: true, cached: true };
    }

    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);
    const dayKey = this.dayKey(now);

    // Request-bound meters have minute+day control
    const isRequestBound = cfg.rate_per_min !== undefined || cfg.daily_cap !== undefined;

    if (isRequestBound) {
      // MINUTE
      const minute: MinuteState = this.refill(st.minute || { windowStart: 0, tokens: 0 }, cfg, nowSec);
      if ((minute.tokens || 0) < qty) {
        const window = this.minuteWindowSeconds();
        const nextRefill = (minute.windowStart || Math.floor(nowSec / window) * window) + window;
        const retry = Math.max(0, (nextRefill - nowSec) * 1000);
        return this.rateLimitResponse(retry);
      }
      minute.tokens -= qty;

      // DAY CAP
      const day: DayState = st.day && st.day.dayKey === dayKey ? st.day : { dayKey, used: 0 };
      if (cfg.daily_cap !== undefined && day.used + qty > cfg.daily_cap) {
        return this.rateLimitResponse(); // RATE_LIMIT (no retry_after)
      }
      day.used += qty;

      // Commit
      st.minute = minute;
      st.day = day;
      st.idem = st.idem || {};
      if (body.op_key) st.idem[body.op_key] = true;
      await this.saveMeterState(tenant, meter, st);

      return { ok: true };
    }

    // Batch-bound: no realtime check here (always OK). Indexer will rate/charge later.
    st.idem = st.idem || {};
    if (body.op_key) st.idem[body.op_key] = true;
    await this.saveMeterState(tenant, meter, st);
    return { ok: true };
  }

  private async snapshot(tenant_id: string) {
    const meters: Meter[] = ["tool_call","messenger_envelope","rtc_min","egress_bytes","storage_bytes_month","encode_min"];
    const out: Record<string, any> = {};
    for (const m of meters) {
      out[m] = await this.state.storage.get(`meter:${tenant_id}:${m}`);
    }
    return out;
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    // Namespace routing under /billing/*
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/billing/, "");

    // Route to DO by tenant (or global "demo") for /quota/*
    if (pathname.startsWith("/quota/")) {
      let tenant = "demo";
      try { tenant = (await request.clone().json()).tenant_id || "demo"; } catch {}
      const id = env.QUOTA_DO.idFromName(`quota:${tenant}`);
      const stub = env.QUOTA_DO.get(id);
      const innerURL = new URL(`https://do.internal${pathname}`);
      return stub.fetch(new Request(innerURL.toString(), request));
    }

    // Plans & tenants endpoints (KV backed)
    if (pathname.startsWith("/plans/") || pathname.match(/^\/tenants\/[^/]+\/plan$/)) {
      const id = env.QUOTA_DO.idFromName(`quota:admin`);
      const stub = env.QUOTA_DO.get(id);
      const innerURL = new URL(`https://do.internal${pathname}`);
      return stub.fetch(new Request(innerURL.toString(), request));
    }

    return new Response("Not Found", { status: 404 });
  },

  // Indexer stub (scheduled): wire later to aggregate to D1
  async scheduled(event, env, ctx) {
    // TODO: read from logs/ledger and write rollups into BILLING_DB
  }
};

export default worker;
