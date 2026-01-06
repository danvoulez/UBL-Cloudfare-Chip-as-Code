# 🔌 UBL Messenger - Frontend Wiring Report

> **Status**: UPDATED - Backend implemented!  
> **Date**: December 2024

---

## Summary (UPDATED)

| Category | Total | ✅ Wired | 🟡 Partial | ❌ Missing Backend |
|----------|-------|----------|------------|-------------------|
| **Buttons/Actions** | 28 | 18 | 6 | 4 |
| **Data Sources** | 12 | 9 | 2 | 1 |
| **Real-time Events** | 5 | 2 | 0 | 3 |

## 🎉 NEWLY IMPLEMENTED

### Backend (messenger_v1.rs)
- ✅ `GET /messenger/bootstrap` - Aggregates user, entities, conversations, messages
- ✅ `POST /messenger/messages` - Send message (commits to C.Messenger ledger)
- ✅ `POST /messenger/conversations` - Create workstream
- ✅ `GET /messenger/conversations` - List conversations
- ✅ `GET /messenger/entities` - List entities
- ✅ `POST /messenger/jobs/:id/approve` - Approve job (commits to C.Jobs)
- ✅ `POST /messenger/jobs/:id/reject` - Reject job (commits to C.Jobs)

### WebAuthn (already existed)
- ✅ `POST /id/register/begin` + `finish`
- ✅ `POST /id/login/begin` + `finish`
- ✅ `GET /id/whoami`

### Frontend Updated
- ✅ `ublApi.ts` - Updated to use `/messenger/*` endpoints
- ✅ `JobCardRenderer.tsx` - Approve/Reject now call real API
- ✅ `ChatPage.tsx` - sendMessage calls real API when not demo mode
- ✅ `ChatPage.tsx` - createConversation calls real API

---

## 1. AUTHENTICATION (LoginPage.tsx)

### Buttons

| Button | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Sign In with Passkey** | ❌ Missing | `POST /id/login/begin` → `POST /id/login/finish` | Endpoints defined but NOT in UBL Kernel yet |
| **Create Passkey** | ❌ Missing | `POST /id/register/begin` → `POST /id/register/finish` | Endpoints defined but NOT in UBL Kernel yet |
| **Try Demo Mode** | ✅ Works | N/A (localStorage) | No backend needed |
| **Sign In / Register Tab** | ✅ Works | N/A (UI state) | No backend needed |

### Required Backend (UBL Kernel)

```rust
// Routes needed in ubl-server
POST /id/register/begin   → Challenge + PublicKeyCredentialCreationOptions
POST /id/register/finish  → Verify attestation, store credential
POST /id/login/begin      → Challenge + PublicKeyCredentialRequestOptions
POST /id/login/finish     → Verify assertion, return session_token
GET  /id/whoami           → { sid, display_name, kind, authenticated }
```

---

## 2. SIDEBAR (Sidebar.tsx)

### Buttons

| Button | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Profile Click** | 🟡 Partial | Needs: `GET /api/me` | Opens inspect modal (prop `onInspectEntity` - NOT connected in ChatPage) |
| **Status Toggle** | ❌ Missing | `PUT /api/me { status }` | Cycles online/away/busy but NOT persisted |
| **New Workstream (+)** | 🟡 Partial | `POST /api/conversations` | Frontend uses prompt() - needs proper modal + API call |
| **Settings (⚙️)** | 🟡 Partial | - | Opens inspect modal with settings tab - NOT connected |
| **Logout** | ✅ Works | N/A (localStorage clear) | Works but should call `POST /id/logout` |
| **Search Input** | ✅ Works | N/A (local filter) | Works client-side only |
| **Conversation Click** | ✅ Works | N/A (navigation) | Works via React Router |

### Data Sources

| Data | Status | Backend Endpoint | Notes |
|------|--------|------------------|-------|
| `conversations` | ✅ Works | `GET /api/bootstrap` → `conversations[]` | Loaded on mount |
| `entities` | ✅ Works | `GET /api/bootstrap` → `entities[]` | Loaded on mount |
| `currentUser` | 🟡 Partial | Should come from `GET /api/me` | Currently hardcoded from constants |
| `unreadCount` | ❌ Missing | Needs WebSocket + projection | Not tracked on backend |
| `lastMessageTime` | ❌ Missing | Needs `updated_at` in projection | Not returned by API |
| Live "Online" status | ❌ Missing | Needs presence WebSocket | Not implemented |

---

## 3. CHAT VIEW (ChatView.tsx)

### Header Buttons

| Button | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Back (Mobile)** | ✅ Works | N/A (navigation) | Works |
| **Avatar Click** | 🟡 Partial | - | Should open entity profile - NOT connected |
| **Call Button (📞)** | ❌ Stub | NOT PLANNED | Visual only - no functionality |
| **More Button (⋯)** | ❌ Stub | - | Visual only - should open menu (edit, delete, etc.) |

### Message Input

| Action | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Send Message** | 🟡 Partial | `POST /api/messages` | API defined but NOT called - uses local state |
| **Attach Button (+)** | ❌ Missing | `POST /api/files/upload` → MinIO | Visual only |
| **Emoji Picker** | ❌ Missing | N/A | Not implemented |
| **Voice Message** | ❌ Missing | - | Not planned |

### Message Display

| Feature | Status | Backend Endpoint | Notes |
|---------|--------|------------------|-------|
| Messages list | ✅ Works | `GET /api/bootstrap` → `messages[]` | Loaded on mount |
| Message hash display | ✅ Works | N/A | Shown from message data |
| Typing indicator | ✅ Works | N/A (local) | Simulated, not from WebSocket |
| Read receipts | ❌ Missing | Needs WebSocket event | Not implemented |
| Ledger entries count | 🟡 Partial | - | Shows local count, not from ledger |

### Job Cards (JobCardRenderer.tsx)

| Button | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Approve** | ❌ Missing | `POST /api/jobs/{id}/approve` | Sends chat message instead of API call |
| **Reject** | ❌ Missing | `POST /api/jobs/{id}/reject` | Sends chat message instead of API call |
| **View Result** | 🟡 Partial | - | Opens URL if present in metadata |

---

## 4. WELCOME SCREEN (WelcomeScreen.tsx)

### Buttons

| Button | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Recent Conversation Click** | ✅ Works | N/A | Navigation |
| **New Workstream** | 🟡 Partial | `POST /api/conversations` | Uses prompt() - needs modal |
| **Protocol Settings** | ❌ Missing | - | `onOpenSettings` prop not passed |

### Data Sources

| Data | Status | Notes |
|------|--------|-------|
| Workstreams count | ✅ Works | From conversations.length |
| AI Agents count | ✅ Works | Filtered from entities |
| Humans count | ✅ Works | Filtered from entities |

---

## 5. SETTINGS PAGE (SettingsPage.tsx)

### Toggles/Actions

| Setting | Status | Backend Endpoint | Notes |
|---------|--------|------------------|-------|
| **Dark Mode Toggle** | ❌ Local only | `PUT /api/settings` | Not persisted to backend |
| **Glow Intensity Slider** | ❌ Local only | `PUT /api/settings` | Not persisted to backend |
| **Notifications Toggle** | ❌ Local only | - | Not persisted |
| **Sounds Toggle** | ❌ Local only | - | Not persisted |
| **Passkeys Management** | ❌ Stub | `GET /id/credentials`, `DELETE /id/credentials/{id}` | Shows "Coming soon" |
| **Connected Services** | ❌ Stub | - | Shows "Coming soon" |
| **Log Out** | ✅ Works | N/A (clears localStorage) | Should call `POST /id/logout` |
| **Edit Profile** | ❌ Stub | `PUT /api/me` | Button present, no action |

---

## 6. BRIDGE CONFIG (BridgeConfig.tsx)

### Buttons

| Button | Status | Backend Endpoint | Notes |
|--------|--------|------------------|-------|
| **Connect to Backend** | ✅ Works | `GET /api/health` | Tests connection |
| **Continue with Demo Mode** | ✅ Works | N/A | Sets empty URL in localStorage |

---

## 7. REAL-TIME EVENTS (WebSocket)

### Events Expected

| Event | Status | Backend Required | Notes |
|-------|--------|------------------|-------|
| `JobUpdate` | ✅ Wired | `WsJobUpdate` from Kernel | Handler exists in jobsApi.ts |
| `JobComplete` | ✅ Wired | `WsJobComplete` from Kernel | Handler exists in jobsApi.ts |
| `ApprovalNeeded` | 🟡 Partial | `WsApprovalNeeded` from Kernel | Handler exists but UI doesn't show modal |
| `NewMessage` | ❌ Missing | - | Need to add to kernel |
| `PresenceUpdate` | ❌ Missing | - | For online/offline status |
| `TypingIndicator` | ❌ Missing | - | Real typing from other users |

---

## 8. API ENDPOINTS INVENTORY

### Defined in ublApi.ts (Frontend expects these)

| Endpoint | Method | Exists in Kernel? |
|----------|--------|-------------------|
| `/api/health` | GET | ✅ Yes (`/health`) |
| `/api/bootstrap` | GET | ❌ No |
| `/api/me` | GET | ❌ No |
| `/api/me` | PUT | ❌ No |
| `/api/settings` | GET | ❌ No |
| `/api/settings` | PUT | ❌ No |
| `/api/entities` | GET | ❌ No |
| `/api/entities` | POST | ❌ No |
| `/api/conversations` | GET | ❌ No |
| `/api/conversations` | POST | ❌ No |
| `/api/messages` | POST | ❌ No |
| `/api/assets/pin` | POST | ❌ No |
| `/api/assets/unpin` | POST | ❌ No |
| `/api/ledger/logs` | GET | ✅ Partial (via `/ledger/{id}/tail`) |
| `/api/tenant/provision` | POST | ❌ No |
| `/api/tenant/join` | POST | ❌ No |
| `/api/session` | POST | ❌ No |

### Defined in jobsApi.ts (Frontend expects these)

| Endpoint | Method | Exists in Kernel? |
|----------|--------|-------------------|
| `/api/jobs` | GET | 🟡 Via projection `/query/jobs` |
| `/api/jobs` | POST | ❌ No (needs Console) |
| `/api/jobs/{id}` | GET | 🟡 Via projection `/query/jobs/{id}` |
| `/api/jobs/{id}/approve` | POST | ❌ No |
| `/api/jobs/{id}/reject` | POST | ❌ No |
| `/api/jobs/{id}/cancel` | POST | ❌ No |
| `/api/jobs/{id}/approvals` | GET | 🟡 Via `/query/jobs/{id}/approvals` |
| `/api/jobs/{id}/approvals/{id}` | POST | ❌ No |
| `/ws` | WS | 🟡 Needs SSE adapter or WS endpoint |

### Defined but not in frontend (Already in Kernel)

| Endpoint | Purpose |
|----------|---------|
| `POST /link/commit` | Commit ubl-link |
| `POST /link/validate` | Validate without commit |
| `GET /state/{container_id}` | Get container state |
| `GET /ledger/{id}/tail` | Tail ledger entries |
| `GET /atom/{hash}` | Get atom by hash |
| `POST /v1/policy/permit` | Issue permit (Console) |
| `POST /v1/commands/issue` | Issue command (Console) |
| `GET /v1/commands` | Query commands (Console) |
| `POST /v1/exec.finish` | Register receipt (Console) |

---

## 9. PRIORITY FIXES

### 🔴 P0 - Critical (Auth & Core Flow)

1. **Implement WebAuthn endpoints in UBL Kernel**
   - `/id/register/begin`, `/id/register/finish`
   - `/id/login/begin`, `/id/login/finish`
   - `/id/whoami`

2. **Create `/api/bootstrap` endpoint**
   - Returns: entities, conversations, messages for user
   - Single call to load initial state

3. **Create `/api/messages` POST endpoint**
   - Send message → commit to ledger
   - Return message with hash

### 🟠 P1 - Important (Core Features)

4. **Wire Job Card approve/reject to API**
   - Currently sends chat message instead of API call
   - Should call `jobsApi.approve()` / `jobsApi.reject()`

5. **Add `/api/conversations` CRUD**
   - List, create workstreams
   - Replace prompt() with proper modal

6. **Add real-time message updates**
   - WebSocket or SSE for new messages
   - Currently only jobs have real-time

### 🟡 P2 - Enhancement

7. **File upload to MinIO**
   - `/api/files/upload` → returns S3 key
   - Attach to messages

8. **Settings persistence**
   - `PUT /api/settings` to save user preferences

9. **Search functionality**
   - Global search across messages/workstreams
   - Currently only filters locally

---

## 10. ARCHITECTURE GAP

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  LoginPage │ Sidebar │ ChatView │ WelcomeScreen │ Settings     │
├─────────────────────────────────────────────────────────────────┤
│  ublApi.ts │ jobsApi.ts │ apiClient.ts                         │
│  ↓ HTTP    │ ↓ HTTP/WS │                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│                    🔴 MISSING: MESSENGER API LAYER              │
│                                                                 │
│  /api/bootstrap     - aggregate entities/convs/messages        │
│  /api/me            - user profile CRUD                        │
│  /api/conversations - workstream CRUD                          │
│  /api/messages      - send message → ledger commit             │
│  /api/files         - upload to MinIO                          │
│  /api/settings      - user preferences                         │
│  /ws                - real-time message events                  │
│                                                                 │
│  This layer translates "chat semantics" to "UBL commits"       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      UBL KERNEL (Exists)                        │
├─────────────────────────────────────────────────────────────────┤
│  /link/commit       - core ledger commit                       │
│  /state/{id}        - container state                          │
│  /query/jobs        - job projections                          │
│  /v1/policy/permit  - Console API                              │
│  /id/...            - 🔴 WebAuthn (needs implementation)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. RECOMMENDED NEXT STEPS

```bash
# 1. Implement Messenger API layer (can be in same ubl-server or separate)
cargo new messenger-api
# OR add to ubl-server/src/messenger_v1.rs

# 2. Add routes
POST /api/bootstrap   - returns user's initial state
POST /api/messages    - content → ubl-link commit
POST /api/files       - multipart upload → MinIO

# 3. Wire frontend properly
- Replace local state mutations with API calls
- Connect approve/reject buttons to jobsApi
- Add proper modals for create workstream
```

---

## Files Modified in This Report

| File | Purpose |
|------|---------|
| `src/pages/LoginPage.tsx` | WebAuthn login UI |
| `src/components/Sidebar.tsx` | Navigation + actions |
| `src/components/ChatView.tsx` | Message display + input |
| `src/components/WelcomeScreen.tsx` | Landing state |
| `src/components/cards/JobCardRenderer.tsx` | Job cards |
| `src/pages/SettingsPage.tsx` | User settings |
| `src/services/ublApi.ts` | API calls defined |
| `src/services/jobsApi.ts` | Jobs + WebSocket |

