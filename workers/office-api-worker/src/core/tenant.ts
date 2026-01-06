export function resolveTenant(req: Request, defaultTenant = "voulezvous") {
  const h = new URL(req.url).host;
  if (h.endsWith("voulezvous.tv")) return "voulezvous";
  return defaultTenant;
}
