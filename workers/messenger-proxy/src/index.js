addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  if (request.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  const env = {
    CF_ACCESS_CLIENT_ID: typeof CF_ACCESS_CLIENT_ID !== 'undefined' ? CF_ACCESS_CLIENT_ID : '',
    CF_ACCESS_CLIENT_SECRET: typeof CF_ACCESS_CLIENT_SECRET !== 'undefined' ? CF_ACCESS_CLIENT_SECRET : '',
    UPSTREAM_LLM: typeof UPSTREAM_LLM !== 'undefined' ? UPSTREAM_LLM : 'https://office-llm.ubl.agency',
    UPSTREAM_MEDIA: typeof UPSTREAM_MEDIA !== 'undefined' ? UPSTREAM_MEDIA : 'https://api.ubl.agency/media',
    UPSTREAM_JOBS: typeof UPSTREAM_JOBS !== 'undefined' ? UPSTREAM_JOBS : ''
  };
  
  const withAccess = (init = {}) => {
    const headers = new Headers(init.headers || {});
    if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
      headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID);
      headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET);
    }
    return { ...init, headers };
  };
  
  const proxy = async (upstream) => {
    const path = url.pathname.replace(/^\/(llm|media|jobs)/, "");
    const target = new URL(path + url.search, upstream);
    const init = {
      method: request.method,
      headers: request.headers,
      body: request.body
    };
    const out = withAccess(init);
    const res = await fetch(target.toString(), out);
    const resp = new Response(res.body, res);
    resp.headers.set("access-control-allow-origin", url.origin);
    resp.headers.set("access-control-allow-credentials", "true");
    resp.headers.set("access-control-allow-headers", "authorization,content-type");
    resp.headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return resp;
  };
  
  if (url.pathname.startsWith("/llm")) return proxy(env.UPSTREAM_LLM);
  if (url.pathname.startsWith("/media")) return proxy(env.UPSTREAM_MEDIA);
  if (url.pathname.startsWith("/jobs")) {
    if (!env.UPSTREAM_JOBS) {
      return new Response(JSON.stringify({ ok: false, error: "jobs upstream not configured" }), {
        status: 501,
        headers: { "content-type": "application/json" }
      });
    }
    return proxy(env.UPSTREAM_JOBS);
  }
  
  if (url.pathname === "/healthz") {
    return new Response(JSON.stringify({ ok: true, service: "messenger-proxy" }), {
      headers: { "content-type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ ok: false, error: "route not found" }), {
    status: 404,
    headers: { "content-type": "application/json" }
  });
}
