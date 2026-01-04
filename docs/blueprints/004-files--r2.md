Blueprint 04 — Files / R2 (simples, seguro e “chip-ready”).

04) Files — R2 (S3-compat) + presign pelo Core

1) Propósito
	•	Guardar blobs (imagens, PDFs, exportações) fora dos apps.
	•	Nunca trafegar arquivo via API; só URLs presignadas.
	•	Cada upload gera um Átomo JSON✯Atomic e entra no ledger.

⸻

2) Fluxo canônico (upload/download)

Upload
	1.	App chama POST /files/presign/upload { key, content_type, size }.
	2.	Core responde { url, headers, expires_in }.
	3.	Cliente faz PUT direto no R2 usando url e headers.
	4.	Core grava átomo file.created (contendo key, size, content_type, etag) e retorna o atomic_hash.

Download
	1.	App chama POST /files/presign/download { key }.
	2.	Core responde { url, expires_in }.
	3.	Cliente faz GET direto no R2.

Autorização de quem pode gerar presigns é decidida pelo chip antes. A Core só materializa.

⸻

3) Layout de chaves (R2)

ubl-files/
  {tenant}/
    {kind}/
      {id}/
        v{n}/              # versões se necessário
          {basename}.bin   # arquivo
          meta.json        # metadados leves (opcional)

Ex.: ubl/contract/ct_01J…/v1/contract.pdf
	•	tenant → “ubl” por padrão; multi-tenant no futuro.
	•	kind   → contract, invoice, avatar, export, etc.

⸻

4) Metadados mínimos (headers do objeto)
	•	content-type (obrigatório)
	•	content-length (obrigatório no presign)
	•	etag (do R2, retornado após upload)
	•	(opcional) x-ubl-actor (email) e x-ubl-trace (traceId) — sem dados sensíveis.

⸻

5) Política (ligação com o chip)
	•	Para /files/presign/*, exige W_ZeroTrust_Standard (já definido).
	•	Para presigns admin (ex.: exports completos), usa /admin/files/* → exige W_Admin_Path_And_Role.
	•	Rate-limit leve (bit P_Rate_Bucket_OK) também vale aqui.

⸻

6) CORS (R2 / custom domain via Cloudflare)

Se o front fizer upload direto do browser:
	•	Permitir PUT e GET, cabeçalhos content-type, content-md5, x-amz-*.
	•	Origin: app.ubl.agency.

⸻

7) Lifecycle & retenção
	•	Expirar presigns em 10–15 min.
	•	Expirar objetos temporários (tmp/…) em 24h (lifecycle rule do R2).
	•	(Opcional) Arquivar versões antigas em v{n}/ conforme política de negócio.
	•	Server-side encryption ativada por padrão no R2 (nada a fazer).

⸻

8) Permissões (credenciais mínimas)

Crie uma key R2 somente com:
	•	s3:PutObject, s3:GetObject, s3:HeadObject, s3:DeleteObject no bucket ubl-files.
	•	Sem listar bucket público; a Core gera chaves determinísticas.

⸻

9) Endpoints da Core (já definidos)
	•	POST /files/presign/upload { key, content_type, size }
→ valida extensão/tipo/size, emite URL PUT, devolve cabeçalhos exigidos.
	•	POST /files/presign/download { key }
→ emite URL GET.

Regra simples:
	•	Tamanho máximo (ex.: 25 MB) validado na Core antes do presign.
	•	Lista branca de tipos por kind (ex.: contract → application/pdf).

⸻

10) Átomo de negócio (exemplo)

{
  "id": "fa_01JABC…",
  "ts": "2026-01-03T14:22:01.123Z",
  "kind": "file.created",
  "scope": { "tenant": "ubl" },
  "actor": { "email": "dan@ubl.agency", "groups": ["ubl-ops"] },
  "refs": { "key": "ubl/contract/ct_01J…/v1/contract.pdf" },
  "data": { "size": 482133, "content_type": "application/pdf", "etag": "9f6a…", "sha256": null },
  "meta": { "service": "core-api@1.0.0" },
  "sig": null
}

	•	atomic_hash calculado e retornado na criação do presign ou após callback de confirmação (quando necessário).

⸻

11) Deploy (CLI curto)

# R2: criar bucket (se ainda não existir) e aplicar lifecycle (tmp/ → 1d)
# Core API já tem handlers de presign; só conferir envs:

export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET=ubl-files

# Reiniciar Core após setar envs
sudo systemctl restart ubl-core-api


⸻

12) Proof of Done (checagens objetivas)
	•	POST /files/presign/upload → retorna URL PUT com expires_in > 0.
	•	curl -X PUT -T sample.pdf "<URL>" -H "content-type: application/pdf" → 200/OK.
	•	POST /files/presign/download → URL válida; curl -I <URL> → 200.
	•	Linha “file.created” no ledger (arquivo ou via Proxy).
	•	Arquivo aparece em r2://ubl-files/ubl/contract/... com content-type correto.

⸻

13) Runbook (falhas comuns)
	1.	403 na geração de presign → chip negou. Checar /_reload, policy_deny_total, grupos do Access.
	2.	PUT falha (403/SignatureDoesNotMatch) → relógio do cliente fora, header faltando (content-type, content-length), URL expirada.
	3.	GET baixa vazio → key incorreta (prefixo/tenant/kind) ou object overwriting (versões): use v{n}/.
	4.	Mime errado → o browser depende de content-type — validar/forçar no presign e upload.

⸻

14) Extras (opcionais úteis)
	•	Checksum do cliente (content-md5) no presign e validação no R2.
	•	Antivírus offline no LAB 256: Cron que lista chaves novas, baixa, roda ClamAV, marca meta.json com malware=true, elege ação (quarentena).
	•	Thumbs/derivados: job local que gera previews em …/v1/{basename}.thumb.jpg (sem fila paga; cron ou webhook interno).
	•	Expiração por kind: avatar retém menos que contract.

⸻

15) Segurança (regras de ouro)
	•	Nunca aceitar upload “por trás” (sem presign).
	•	Não armazenar segredos no objeto (só metadados inocentes).
	•	URLs presignadas são capabilities temporárias; mínimo tempo possível.
	•	Download público só via presign (sem bucket público).

⸻

