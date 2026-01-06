// persist/ops_receipts.ts
// Persist operation receipts

export interface OpReceipt {
  id: string;
  op: string;
  actor: string;
  payload: Record<string, any>;
  fileId?: string;
  familyId?: string;
}

export async function persistOpReceipt(
  env: any,
  receipt: OpReceipt
): Promise<void> {
  await env.OFFICE_DB.prepare(
    `INSERT INTO version_ops_receipt (id, op, actor, payload_json, file_id, family_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    receipt.id,
    receipt.op,
    receipt.actor,
    JSON.stringify(receipt.payload),
    receipt.fileId || null,
    receipt.familyId || null,
    Date.now()
  ).run();
}
