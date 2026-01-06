export interface Env {
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
  UPSTREAM_LLM: string
  UPSTREAM_MEDIA: string
  UPSTREAM_JOBS?: string
}

const json = (obj: any, status = 200) => new Response(JSON.stringify(obj), { 
  status, 
  headers: { "content-type": "application/json" } 
})

const withAccess = (env: Env, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {})
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID)
    headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET)
  }
  return { ...init, headers }
}

const proxy = async (req: Request, upstream: string, env: Env) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/(llm|media|jobs)/, "")
  const target = new URL(path + url.search, upstream)
  const init: RequestInit = { method: req.method, headers: req.headers, body: req.body }
  
  init.headers = new Headers(req.headers)
  const out = withAccess(env, init)
  
  const res = await fetch(target.toString(), out)
  const resp = new Response(res.body, res)
  resp.headers.set("access-control-allow-origin", url.origin)
  resp.headers.set("access-control-allow-credentials", "true")
  resp.headers.set("access-control-allow-headers", "authorization,content-type")
  resp.headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
  return resp
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    
    if (req.method === "OPTIONS") return json({ ok: true })
    
    if (url.pathname.startsWith("/llm")) return proxy(req, env.UPSTREAM_LLM, env)
    if (url.pathname.startsWith("/media")) return proxy(req, env.UPSTREAM_MEDIA, env)
    if (url.pathname.startsWith("/jobs")) {
      if (!env.UPSTREAM_JOBS) return json({ ok:false, error:"jobs upstream not configured" }, 501)
      return proxy(req, env.UPSTREAM_JOBS, env)
    }
    
    if (url.pathname === "/healthz") return json({ ok: true, service: "messenger-proxy" })
    
    return json({ ok:false, error:"route not found" }, 404)
  }
}
