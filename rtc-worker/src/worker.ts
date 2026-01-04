// RTC Signaling Worker — Durable Object RoomDO
// Endpoint: wss://rtc.voulezvous.tv/rooms?id=<roomId>

export interface Env {
  ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // WS endpoint: wss://rtc.voulezvous.tv/rooms?id=<roomId>
    if (url.pathname === "/rooms") {
      if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const id = url.searchParams.get("id") || "default";
      const stub = env.ROOMS.idFromName(id);
      const obj = env.ROOMS.get(stub);
      return obj.fetch("https://do/ws", req);
    }

    // Health
    if (url.pathname === "/healthz") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

export class RoomDO {
  state: DurableObjectState;
  sockets: Set<WebSocket>;
  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.sockets = new Set();
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/ws" || req.headers.get("upgrade") !== "websocket") {
      return new Response("DO endpoint", { status: 200 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const heartbeat = () => {
      try { server.send(JSON.stringify({ type: "ping", ts: Date.now() })); } catch {}
    };

    const broadcast = (obj: any, except?: WebSocket) => {
      const msg = JSON.stringify(obj);
      for (const ws of this.sockets) {
        if (ws !== except) {
          try { ws.send(msg); } catch {}
        }
      }
    };

    const close = () => {
      this.sockets.delete(server);
      broadcast({ type: "presence.update", online: this.sockets.size });
      try { server.close(); } catch {}
    };

    server.addEventListener("message", (ev: MessageEvent) => {
      let data: any;
      try { data = JSON.parse(String(ev.data)); } catch { return; }

      switch (data?.type) {
        case "hello":
          // attach if first message
          if (!this.sockets.has(server)) {
            this.sockets.add(server);
            broadcast({ type: "presence.update", online: this.sockets.size });
          }
          server.send(JSON.stringify({ type: "ack", ok: true }));
          break;
        case "presence.update":
          // fan-out lightweight presence payload
          broadcast({ type: "presence.update", ...data }, server);
          break;
        case "signal":
          // pass-through for WebRTC SDP/ICE
          // {type:"signal", to?:string, payload:{...}}
          broadcast({ type: "signal", payload: data.payload }, server);
          break;
        case "pong":
        default:
          break;
      }
    });

    server.addEventListener("close", close);
    server.addEventListener("error", close);

    // simple heartbeat
    const interval = setInterval(heartbeat, 15_000);
    this.state.waitUntil((async () => {
      // cleanup timer when socket closes
      await new Promise<void>((resolve) => {
        server.addEventListener("close", () => resolve());
        server.addEventListener("error", () => resolve());
      });
      clearInterval(interval);
    })());

    return new Response(null, { status: 101, webSocket: client });
  }
}
