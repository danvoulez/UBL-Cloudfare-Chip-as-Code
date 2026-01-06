export const inventory = async (env: any) => {
  try {
    const rs = await env.OFFICE_DB
      .prepare("SELECT id, path, kind, canonical FROM files LIMIT 10")
      .all();
    return new Response(
      JSON.stringify({ ok: true, files: rs.results ?? [] }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such column")) {
      const fallback = await env.OFFICE_DB
        .prepare(
          "SELECT id, " +
          "       COALESCE(path, name, '') AS path, " +
          "       COALESCE(kind, mime, 'blob') AS kind, " +
          "       COALESCE(canonical, 0) AS canonical " +
          "FROM files LIMIT 10"
        )
        .all();
      return new Response(
        JSON.stringify({
          ok: true,
          files: fallback.results ?? [],
          note: "compat: inferred columns from name/mime"
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
