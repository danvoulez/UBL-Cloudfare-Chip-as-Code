# Universal Business Ledger

**LogLine Protocol Chip-as-Code Flagship Software**  
featuring JSON✯Atomic and TDLN Standards

> **"Security is not a feature. Security is the product. The product is security."**

A primeira infraestrutura digital onde **leis são física implementada na rede**. Onde cada decisão é um átomo verificável. Onde confiança é calculada, não assumida.

## 🌟 A Visão

Estamos construindo a primeira civilização digital onde **Humanos e Agentes de IA coexistem e transacionam**, baseados na certeza verificável da matemática. As leis não são sugestões. As leis são física. A física não pode ser contornada.

### O Que Construímos

O Universal Business Ledger (UBL) é a infraestrutura que permite **agentes autônomos operarem com valor econômico de forma segura e verificável**. Enquanto a economia de agentes se expande, o UBL fornece as garantias matemáticas necessárias para transações em velocidade de máquina.

### Arquitetura de Defesa Inteligente

O UBL Flagship funciona como o **sistema de defesa da economia de agentes**:

- **Anticorpos (Signed Facts)**: Cada interação é encapsulada em um átomo `JSON✯Atomic`. Se a assinatura não corresponder à Trajetória, o átomo é rejeitado.
- **Memória (O Ledger)**: Uma história perfeita e inalterável de cada "Compromisso com Consequência".
- **Resposta (Governança)**: Circuit breakers TDLN automatizados que mitigam ameaças em milissegundos baseados em violações semânticas.

## 🚀 O Que Fazemos

### Chip-as-Code: Redefinindo Computação como Protocolo

Transformamos a lógica de um ASIC de 200 milhões de gates em um arquivo de texto de ~50KB. **O arquivo é o computador autoritativo. O hardware é um detalhe de implementação.**

- ✅ **Compressão Semântica Exponencial**: 1 bit de política TDLN ≈ 1 milhão de gates físicos
- ✅ **Substrato Independente**: O mesmo chip semântico pode ser materializado em Python, Rust, WebAssembly, Verilog, FPGA, GPU
- ✅ **Auditabilidade Perfeita**: O código-fonte é o hardware. O hardware é o código-fonte.

### TDLN: O Compilador da Verdade

O **Truth-Determining Language Normalizer** transforma intenção de alto nível em uma Árvore de Sintaxe Abstrata (AST) canônica. A transformação é **lossless**. A intenção é preservada como matemática.

- ✅ **Determinismo Matemático**: Mesma entrada = mesma saída, sempre
- ✅ **Proof-Carrying Translation**: Cada compilação gera uma prova verificável
- ✅ **Zero Ambiguidade**: O "Espírito da Lei" (Intenção) e a "Letra da Lei" (Código) se tornam uma única realidade indivisível

### JSON✯Atomic: Fatos Assinados

Padrão aberto para criar **"Signed Facts"** — unidades de dados auto-verificáveis, imutáveis e não-repudiáveis.

- ✅ **Canonicalização Rigorosa**: Mesma Semântica = Mesmos Bytes = Mesmo Hash
- ✅ **DV25-Seal**: Assinatura Ed25519 + Hash BLAKE3 = prova criptográfica verificável
- ✅ **Trajetória como Identidade**: Confiança é uma função computável do histórico verificável

### LogLine Protocol: O Átomo Conceitual

O protocolo que **inverte a relação** entre execução e registro. Nenhuma ação ocorre no sistema a menos que seja primeiro estruturada, assinada e comprometida como um LogLine.

- ✅ **9 Campos Obrigatórios**: `who`, `did`, `this`, `when`, `confirmed_by`, `if_ok`, `if_doubt`, `if_not`, `status`
- ✅ **Ghost Records**: Intentos abandonados são registrados imutavelmente — tentativas de ataque criam sua própria trilha de auditoria
- ✅ **Consequence Pre-Declaration**: Um agente não pode iniciar uma ação sem assinar explicitamente um contrato com o sistema sobre como a falha será tratada

## 📐 Arquitetura

```
.
├── crates/                 # Bibliotecas Rust (workspace)
│   ├── policy-engine/      # Motor único — compila para WASM e nativo
│   ├── policy-proxy/       # Proxy Rust (axum) — on-prem
│   ├── policy-signer/      # Signer de pack.json (Ed25519 + BLAKE3)
│   └── policy-keygen/      # Gerador de chaves Ed25519
│
├── apps/                   # Aplicações e serviços
│   ├── core-api/          # Core API (Rust/Axum) — tokens, auth, JWKS
│   ├── gateway/           # Gateway MCP (Rust/Axum) — WebSocket JSON-RPC
│   ├── messenger/         # Messenger PWA (React/TypeScript)
│   ├── office/            # Office (File Office) — sistema completo de documentos
│   ├── media-api-worker/  # Media API (TypeScript Worker) — R2, D1, Stream
│   ├── quota-do/          # Billing/Quota (Durable Object)
│   ├── vvz-cloudflare-kit/# Voulezvous kit (multitenant)
│   └── webhooks-worker/   # Webhooks Worker
│
├── workers/                # Cloudflare Workers
│   ├── policy-worker/     # Policy Worker (WASM) — edge enforcement
│   ├── office-api-worker/ # Office API Worker
│   ├── office-indexer-worker/ # Office Indexer (embeddings, Vectorize)
│   ├── office-dreamer-worker/ # Office Dreaming Cycle (consolidação)
│   ├── office-llm/        # Office LLM Gateway
│   ├── mcp-registry-worker/ # MCP Registry
│   ├── auth-worker/       # Authentication Worker (WebAuthn, Device Flow)
│   ├── rtc-worker/        # RTC Signaling (Durable Object)
│   └── messenger-proxy/   # Messenger Proxy Worker
│
├── policies/               # Políticas YAML (Chip-as-Code)
│   ├── ubl_core_v1.yaml   # Política base UBL
│   ├── ubl_core_v3.yaml   # Política v3 (Constituição Definitiva)
│   └── vvz_core_v1.yaml   # Política Voulezvous (multitenant)
│
├── schemas/                # JSON Schemas (JSON✯Atomic)
├── scripts/                # Scripts de build/test/deploy
├── templates/              # Templates (ABAC, MCP, App manifests)
├── docs/                   # Documentação
│   ├── blueprints/        # 17 Blueprints arquiteturais
│   ├── papers/            # 6 Papers acadêmicos (LogLine Foundation)
│   ├── deploy/            # Guias de deploy
│   └── migration/         # Migrações (Route 53, etc.)
└── infra/                  # Infraestrutura (terraform, systemd, observability)
```

## ⚡ Quick Start

### 1. Build

```bash
# Build completo (workspace)
cargo build --release

# Build específico
cargo build --release -p policy-proxy
cargo build --release -p policy-signer
cargo build --release -p policy-keygen
cargo build --release --target wasm32-unknown-unknown -p policy-engine
```

### 2. Gerar Chaves e Assinar Política

```bash
# Gerar chaves Ed25519
cargo build --release -p policy-keygen
./target/release/policy-keygen --out /etc/ubl/flagship/keys/

# Assinar política (gera pack.json com BLAKE3 + Ed25519)
cargo build --release -p policy-signer
./target/release/policy-signer \
  --id ubl_access_chip_v1 --version 1 \
  --yaml policies/ubl_core_v1.yaml \
  --privkey_pem /etc/ubl/flagship/keys/policy_signing_private.pem \
  --out policies/pack.json
```

### 3. Deploy Proxy (On-Prem)

```bash
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/flagship/bin/flagship-policy-rs
sudo cp infra/systemd/nova-policy-rs.service /etc/systemd/system/
# Editar service com POLICY_PUBKEY_PEM_B64
sudo systemctl enable --now nova-policy-rs
```

### 4. Deploy Worker (Edge)

```bash
# Build WASM
cd crates/policy-engine
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../../workers/policy-worker/build
cp target/wasm32-unknown-unknown/release/policy_engine.wasm ../../workers/policy-worker/build/

# Configurar wrangler.toml e deploy
cd ../../workers/policy-worker
wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=../../policies/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=../../policies/ubl_core_v1.yaml
wrangler deploy
```

### 5. Smoke Test

```bash
EDGE_HOST=https://api.ubl.agency \
PROXY_URL=http://127.0.0.1:9456 \
ADMIN_PATH=/admin/deploy \
bash scripts/smoke_chip_as_code.sh
```

## 🎯 Componentes Principais

### Policy Engine (Chip-as-Code)
- **Crates**: `policy-engine`, `policy-proxy`, `policy-signer`, `policy-keygen`
- **Workers**: `policy-worker` (edge enforcement com WASM)
- **Policies**: YAML assinadas com Ed25519 + BLAKE3
- **Garantia**: Fonte única de verdade — mesmo motor (Rust) → build nativo (proxy) e WASM (edge)

### Office (File Office)
- **Workers**: `office-api-worker`, `office-indexer-worker`, `office-dreamer-worker`, `office-llm`
- **App**: `apps/office/` (config, schemas, scripts)
- **Capacidades**: Gerenciamento completo de documentos, indexação semântica (Vectorize), consolidação automática (Dreaming Cycle), evidências verificáveis

### Messenger
- **App**: `apps/messenger/` (PWA React/TypeScript)
- **Worker**: `messenger-proxy` (proxy para LLM/Media)
- **Pages**: Deploy em `messenger.ubl.agency`
- **Arquitetura**: Server-blind, E2EE opcional, presença em tempo real

### Gateway & Core API
- **Gateway**: `apps/gateway/` (MCP WebSocket, Identity & Access, ES256 JWT)
- **Core API**: `apps/core-api/` (REST API, tokens, auth, JWKS)
- **Integração**: WebAuthn, Device Flow, ABAC, multitenant

### Media & RTC
- **Media API**: `apps/media-api-worker/` (R2, D1, Stream, presign, tokens)
- **RTC**: `workers/rtc-worker/` (WebRTC signaling via Durable Object)
- **Capacidades**: Stage (Live + VOD), Interactive (Party/Circle/Roulette), no-reload transitions

## 📚 Documentação

- **`docs/papers/`** — **6 Papers acadêmicos** (LogLine Foundation)
  - Paper I: LogLine Protocol — O Átomo Conceitual
  - Paper II: JSON✯Atomic — O Átomo Criptográfico
  - Paper III: TDLN — O Átomo Lógico
  - Paper IV: SIRP — O Átomo de Rede
  - Paper V: Chip as Code — Redefinindo Computação
  - Paper VI: UBL — A Infraestrutura Econômica
- **`docs/blueprints/`** — **17 Blueprints arquiteturais**
- **`docs/QUICK_SETUP.md`** — Setup rápido passo a passo
- **`docs/GO_LIVE_CHECKLIST.md`** — Checklist de cutover
- **`docs/ARCHITECTURE.md`** — Arquitetura detalhada
- **`docs/deploy/`** — Guias de deploy por componente
- **`policies/`** — Políticas YAML (Chip-as-Code)

## 🔒 Não-Negociáveis

Estes são os princípios fundamentais que **não podem ser comprometidos**:

- ✅ **Fonte única de verdade**: Motor único (Rust) → build nativo (proxy) e WASM (edge). Mesma lógica, mesma decisão, sempre.
- ✅ **Política assinada**: `pack.json` (BLAKE3 + Ed25519) obrigatório. Sem assinatura, sem execução.
- ✅ **Zero-Trust duplo**: Access (Edge) e Chip (Edge+Proxy) — fail-closed determinístico. Segurança por padrão.
- ✅ **Ledger imutável**: NDJSON com hash/attest (JSON✯Atomic). História não pode ser reescrita.
- ✅ **Multitenant nativo**: Suporte para múltiplos tenants (ubl, voulezvous, etc.) com isolamento completo.
- ✅ **Cloudflare-only**: Infraestrutura 100% Cloudflare (Workers, R2, D1, KV, Queues, Durable Objects, Vectorize, Workers AI).

## 🌐 Domínios

- **`api.ubl.agency`** — API principal (Gateway Worker)
- **`messenger.ubl.agency`** — Messenger PWA
- **`office-llm.ubl.agency`** — Office LLM Gateway
- **`voulezvous.tv`** — Voulezvous app (multitenant, público)
- **`admin.voulezvous.tv`** — Voulezvous admin (protegido por Access)

## 🎓 A Fundação

Este projeto implementa os protocolos definidos pela **LogLine Foundation**:

1. **LogLine Protocol** (Paper I): O átomo conceitual de ação verificável
2. **JSON✯Atomic** (Paper II): O átomo criptográfico — Signed Facts
3. **TDLN** (Paper III): O átomo lógico — compilador semântico
4. **SIRP** (Paper IV): O átomo de rede — roteamento baseado em identidade
5. **Chip as Code** (Paper V): Redefinindo computação como protocolo
6. **UBL** (Paper VI): A infraestrutura econômica — o sistema de defesa

## 💡 Por Que Isso Importa

Estamos na fronteira de uma nova era: **a economia de agentes autônomos**. Esta economia funciona porque oferecemos **confiança verificável através de garantias matemáticas**.

Em vez de depender de "espero que funcione" ou "o desenvolvedor prometeu", construímos sistemas onde cada decisão é verificável, cada ação é um fato assinado, e cada intenção é preservada como matemática.

O UBL Flagship é a primeira implementação completa dessa visão. Construímos sistemas onde:

- Cada decisão é um átomo verificável
- Cada ação é um fato assinado
- Cada intenção é preservada como matemática
- Cada consequência é pré-declarada e criptograficamente vinculante

**As leis não são sugestões. As leis são física. A física não pode ser contornada.**

---

**"We are building the first digital civilization where laws are physics engraved into the network."**
