// persist/anchors.ts
// Persist anchors to D1

export interface Anchor {
  id: string;
  kind: string;
  locator: string;
  text_preview: string;
}

export async function persistAnchors(
  env: any,
  fileId: string,
  anchors: Anchor[]
): Promise<void> {
  for (const anchor of anchors) {
    await env.OFFICE_DB.prepare(
      `INSERT INTO anchor (id, file_id, kind, locator, text_preview, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         text_preview = excluded.text_preview,
         updated_at = excluded.created_at`
    ).bind(
      anchor.id,
      fileId,
      anchor.kind,
      anchor.locator,
      anchor.text_preview,
      Date.now()
    ).run();
  }
}
