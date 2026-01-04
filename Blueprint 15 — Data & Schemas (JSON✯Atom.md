Blueprint 15 — Data & Schemas (JSON✯Atomic)

Pronto e empacotado: base canônica + schemas office.* + exemplos + canonicalizers TS/Rust.

Download o kit￼

O que vem no pacote
	•	schemas/atomic.schema.json — envelope base (id, ts, kind, scope, actor, refs, data, meta, sig)
	•	schemas/ledger.office.tool_call.schema.json
	•	schemas/ledger.office.event.schema.json
	•	schemas/ledger.office.handover.schema.json
	•	examples/*.json — amostras válidas (sem conteúdo sensível)
	•	cli/atomic_canonicalize.ts, cli/sign.ts, cli/verify.ts — canonicalizar/assinar/verificar (Ed25519, tweetnacl)
	•	rust/lib.rs — canonicalizador mínimo em Rust
	•	scripts/validate.sh — helper com AJV

Regras canônicas (essência)

Top-level ordem de chaves para serialização/assinatura:
id, ts, kind, scope, actor, refs, data, meta, sig.
	•	id = ULID (recomendado) ou UUIDv4.
	•	ts = ISO-8601 Z.
	•	sig pode ser null (campo presente, assinatura opcional).

Como usar (1 tela)
	1.	Validar schemas

cd json-atomic-schemas-v1
bash scripts/validate.sh    # precisa de `npm i -g ajv-cli`

	2.	Canonicalizar + assinar (demo TS)

cd cli
npm init -y >/dev/null 2>&1 && npm i tweetnacl @types/node --silent
npx ts-node atomic_canonicalize.ts ../examples/office_tool_call.json > /tmp/canon.txt
npx ts-node sign.ts /tmp/canon.txt > /tmp/sig.json
# (opcional) anexar sig no evento e verificar:
npx ts-node verify.ts /tmp/sig.json

	3.	Integrar no Gateway/Office

	•	Usar schemas/atomic.schema.json como contrato único para trilhas (office.tool_call, office.event, office.handover).
	•	Quando for assinar: gerar bytes a partir do JSON canonicalizado (ordem acima), então Ed25519 → sig.value (base64), sig.kid = chave pública ou referência, sig.alg = Ed25519.

Por que isso fecha a conta
	•	Determinismo: a mesma estrutura gera o mesmo byte string.
	•	Privacidade: exemplos e schemas só exigem args_min e metadados mínimos (nada de prompt ou payload em claro).
	•	Portabilidade: TS/Rust já no pacote; fácil plugar no pipeline.
	•	Escalável: adicionar novos kind = só publicar schemas/ledger.<subsys>.<event>.schema.json e examples.

⸻

Proof of Done (check rápido)
	•	bash scripts/validate.sh imprime OK
	•	atomic_canonicalize.ts → saída sem quebras de ordem
	•	sign.ts + verify.ts retornam ok:true nos três exemplos

Pergunta única: quer que eu inclua, já no v1, os schemas de media.* (ex.: media.upload.presigned, media.ingest.started/completed) para o Blueprint 10 ficar 100% acoplado ao Atomic?