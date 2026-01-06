export const health = () => new Response(JSON.stringify({ ok: true, service: "office-api" }), {
  headers: { "content-type": "application/json" }
});
