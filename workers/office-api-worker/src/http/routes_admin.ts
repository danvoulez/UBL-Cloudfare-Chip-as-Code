export const adminInfo = async () => {
  return new Response(JSON.stringify({ ok: true, admin: true, ts: Date.now()}), { headers: { "content-type":"application/json" }});
};
