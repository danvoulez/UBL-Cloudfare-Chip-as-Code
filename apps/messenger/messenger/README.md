# UBL Messenger (PWA Console)

**WhatsApp-like professional messaging for humans and AI agents**

## Architecture — ADR-001 v1.1 Compliant

```
┌─────────────────────────────────────────────────────────────┐
│                    PWA Console (This)                       │
│                    ubl-messenger/frontend                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ permitApi   │  │ registryApi │  │ SSE Client  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                     UBL Server (LAB 256)                    │
│                     Single Backend :8080                    │
│                                                             │
│  POST /v1/policy/permit  │  GET /v1/query/registry/*        │
│  POST /v1/commands/issue │  GET /ledger/:container/tail     │
│  POST /v1/exec.finish    │  POST /link/commit               │
└─────────────────────────────────────────────────────────────┘
          │
          │ Runner pulls pending commands
          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Runner-Factory (LAB 512)                  │
│                   LLM + Tools + Sandbox                     │
│                                                             │
│  GET /v1/query/commands?pending=1  →  execute  →  Receipt   │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

- **Single backend**: All calls go to UBL Server
- **Gateway pattern**: Messenger Gateway routes to Office
- **Event-sourced**: All state changes via UBL ledger commits

## Development

```bash
cd ubl-messenger/frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` and proxies to UBL on `:8080`.

## Environment

Set `VITE_UBL_URL` to point to your UBL server:

```bash
VITE_UBL_URL=http://localhost:8080
VITE_TENANT_ID=T.UBL
VITE_RUNNER_TARGET=LAB_512
```

## API Flow — Permit → Command → Receipt

### 1. Request Permit

```typescript
const permit = await permitApi.requestPermit({
  tenant_id: 'T.UBL',
  actor_id: 'user:alice',
  jobType: 'git.registry.push',
  params: { repo: 'P.demo', branch: 'main' },
  target: 'LAB_512',
});
```

### 2. Issue Command

```typescript
await permitApi.issueCommand({
  jti: permit.permit.jti,
  tenant_id: 'T.UBL',
  jobId: crypto.randomUUID(),
  jobType: 'git.registry.push',
  params: { /* ... */ },
  permit: permit.permit,
  target: 'LAB_512',
  // ...
});
```

### 3. Wait for Receipt (SSE)

```typescript
permitApi.subscribeToReceipts('C.Jobs', (receipt) => {
  console.log('Job completed:', receipt.jobId);
});
```

## Features

- **Conversations**: Direct messages and group chats
- **Cards**: Interactive job cards (approve, reject, monitor)
- **Real-time**: SSE from UBL ledger tail
- **Jobs**: Permit-protected execution on Runner

## Services

| Service | Purpose |
|---------|---------|
| `permitApi.ts` | Permit → Command flow |
| `registryApi.ts` | Git Registry queries |
| `ublApi.ts` | Legacy (bootstrap, messages) |

## Status

- ✅ Frontend: React UI with design system
- ✅ Cards: JobCardRenderer with action buttons
- ✅ permitApi: Permit → Command → Receipt flow
- ✅ registryApi: Project list and detail
- 🚧 WebSocket → SSE migration
- 🚧 Constitution enforcement (client-side AOP)

## License

MIT
