// office-llm: Cloudflare Worker that routes prompts to providers based on policy and X-Content-Policy header.
// - Policies: default (prefer premium then lab) | adult (only lab)
// - Premium providers: OpenAI / Anthropic (keys via secrets)
// - Local providers: Ollama-style endpoints (LAB_*_BASE)

import YAML from "yaml";

interface Env {
  // Secrets
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  // Vars
  LAB_DEFAULT_BASE?: string;
  LAB_ADULT_BASE?: string;
  ALLOW_PREMIUM_DEFAULT?: string;
  // KV for future dynamic policies
  // POLICY_KV?: KVNamespace;
}

// Template será preenchido em runtime (não usar ${} aqui)
const DEFAULT_POLICY_YAML_TEMPLATE = `version: 1
logic:
  default:
    prefer: [openai, anthropic, lab_default]
  adult:
    prefer: [lab_adult, lab_default]

providers:
  openai:
    kind: openai
    url: https://api.openai.com/v1/chat/completions
    model: gpt-4o-mini
  anthropic:
    kind: anthropic
    url: https://api.anthropic.com/v1/messages
    model: claude-3-5-sonnet-latest
  lab_default:
    kind: ollama
    url: __LAB_DEFAULT_BASE__
    model: llama3:8b-instruct
  lab_adult:
    kind: ollama
    url: __LAB_ADULT_BASE__
    model: llama3:8b-instruct
`;

type Role = "system" | "user" | "assistant";
type ChatMsg = { role: Role; content: string };

type GenerateRequest = {
  model?: string;
  messages: ChatMsg[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  // passthrough meta if needed
};

type Provider = {
  key: string;
  kind: "openai" | "anthropic" | "ollama";
  url: string;
  model: string;
};

type Policy = {
  version: number;
  logic: Record<string, { prefer: string[] }>;
  providers: Record<string, { kind: Provider["kind"]; url: string; model: string }>;
};

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  return new Response(res.body, { ...res, headers });
}

function json(data: any, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return cors(new Response(JSON.stringify(data), { ...init, headers }));
}

function text(data: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/plain; charset=utf-8");
  return cors(new Response(data, { ...init, headers }));
}

async function loadPolicy(env: Env): Promise<Policy> {
  // For now, load embedded YAML. Later: fetch from KV if needed.
  let raw = DEFAULT_POLICY_YAML_TEMPLATE;
  // Simple env expansion for __LAB_DEFAULT_BASE__, __LAB_ADULT_BASE__
  const labDefault = env.LAB_DEFAULT_BASE ?? "http://lab-256:11434";
  const labAdult = env.LAB_ADULT_BASE ?? "http://lab-512:11434";
  raw = raw.replace(/__LAB_DEFAULT_BASE__/g, labDefault);
  raw = raw.replace(/__LAB_ADULT_BASE__/g, labAdult);
  const parsed = YAML.parse(raw);
  return parsed as Policy;
}

function headerPolicy(req: Request): "adult" | "default" {
  const h = req.headers.get("X-Content-Policy")?.toLowerCase() ?? "default";
  return (h === "adult" ? "adult" : "default");
}

function pickProvider(policy: Policy, mode: "adult" | "default", env: Env) {
  const prefer = policy.logic[mode]?.prefer ?? [];
  const allowPremium = (env.ALLOW_PREMIUM_DEFAULT ?? "true").toLowerCase() === "true";
  for (const key of prefer) {
    const p = policy.providers[key];
    if (!p) continue;
    if (mode === "adult") {
      // Only lab_* allowed for 'adult'
      if (!key.startsWith("lab_")) continue;
      return { key, ...p };
    } else {
      // default: can use premium if allowed, else fallback to lab
      const isPremium = (p.kind === "openai" || p.kind === "anthropic");
      if (isPremium && !allowPremium) continue;
      // if premium but missing API key, skip
      if (p.kind === "openai" && !env.OPENAI_API_KEY) continue;
      if (p.kind === "anthropic" && !env.ANTHROPIC_API_KEY) continue;
      return { key, ...p };
    }
  }
  throw new Error("No suitable provider available for mode=" + mode);
}

function toOpenAI(req: GenerateRequest, provider: Provider, apiKey: string) {
  const body = {
    model: req.model ?? provider.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.2,
    max_tokens: req.max_tokens ?? 400,
    stream: req.stream ?? false
  };
  return new Request(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
}

function toAnthropic(req: GenerateRequest, provider: Provider, apiKey: string) {
  // Map OpenAI-like messages to Anthropic
  const messages = req.messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  const system = req.messages.find(m => m.role === "system")?.content;
  const body = {
    model: req.model ?? provider.model,
    max_tokens: req.max_tokens ?? 400,
    temperature: req.temperature ?? 0.2,
    stream: req.stream ?? false,
    messages: messages.map(m => ({ role: m.role, content: [{ type: "text", text: m.content }] })),
    ...(system ? { system } : {})
  };
  return new Request(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
}

function toOllama(req: GenerateRequest, provider: Provider) {
  // Ollama chat API: POST /api/chat
  const url = provider.url.replace(/\/$/, "") + "/api/chat";
  const body = {
    model: req.model ?? provider.model,
    messages: req.messages,
    stream: req.stream ?? false,
    options: {
      temperature: req.temperature ?? 0.2,
      num_predict: req.max_tokens ?? 400
    }
  };
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function handleGenerate(request: Request, env: Env) {
  // Opcional: validar Authorization Bearer token (UBL ID)
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    // TODO: validar token via JWKS (id.ubl.agency/.well-known/jwks.json)
    // Por enquanto, apenas logar para auditoria
    const token = authHeader.substring(7);
    // Em produção: verificar assinatura ES256 e claims
  }

  let payload: GenerateRequest;
  try {
    payload = await request.json<GenerateRequest>();
    if (!payload || !Array.isArray(payload.messages)) {
      return json({ ok: false, error: "invalid_request", detail: "messages[] required" }, { status: 400 });
    }
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const policyMode = headerPolicy(request);
  const policy = await loadPolicy(env);
  let provider: Provider;
  try {
    provider = pickProvider(policy, policyMode, env) as Provider;
  } catch (err: any) {
    return json({ ok: false, error: "no_provider", detail: String(err?.message || err) }, { status: 503 });
  }

  let upstreamReq: Request;
  let providerUsed = provider.key;
  try {
    if (provider.kind === "openai") {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
      upstreamReq = toOpenAI(payload, provider, env.OPENAI_API_KEY);
    } else if (provider.kind === "anthropic") {
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
      upstreamReq = toAnthropic(payload, provider, env.ANTHROPIC_API_KEY);
    } else {
      upstreamReq = toOllama(payload, provider);
    }
  } catch (err: any) {
    return json({ ok: false, error: "build_failed", detail: String(err?.message || err) }, { status: 400 });
  }

  const res = await fetch(upstreamReq);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const body = ct.includes("json") ? await res.json().catch(() => ({})) : await res.text();
    return json({ ok: false, error: "upstream_error", provider: providerUsed, status: res.status, body }, { status: 502 });
  }

  // Normalize minimal response
  if (provider.kind === "openai") {
    const data = ct.includes("json") ? await res.json() : await res.text();
    const txt = data?.choices?.[0]?.message?.content ?? String(data);
    return json({ ok: true, provider: providerUsed, model_used: data?.model ?? provider.model, output: { role: "assistant", content: txt } });
  } else if (provider.kind === "anthropic") {
    const data = ct.includes("json") ? await res.json() : await res.text();
    const msg = Array.isArray(data?.content) ? (data.content.find((c:any)=>c.type==="text")?.text ?? "") : String(data);
    return json({ ok: true, provider: providerUsed, model_used: data?.model ?? provider.model, output: { role: "assistant", content: msg } });
  } else {
    // ollama style
    const data = ct.includes("json") ? await res.json() : await res.text();
    const txt = data?.message?.content ?? data?.response ?? String(data);
    return json({ ok: true, provider: providerUsed, model_used: payload.model ?? provider.model, output: { role: "assistant", content: txt } });
  }
}

function notFound() {
  return json({ ok: false, error: "not_found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response("ok"));
    if (url.pathname === "/healthz") return json({ ok: true, service: "office-llm" });

    if (url.pathname === "/policy" && request.method === "GET") {
      const p = await loadPolicy(env);
      return json({ ok: true, policy: p });
    }

    if (url.pathname === "/llm/generate" && request.method === "POST") {
      return handleGenerate(request, env);
    }

    return notFound();
  }
};

