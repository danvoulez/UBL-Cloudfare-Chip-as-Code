# UBL Messenger - Deep Dive: C.Messenger Container Architecture

> **Complete understanding of how Messenger integrates with UBL Kernel and Office**

---

## 🎯 Overview

The Messenger frontend doesn't work in isolation. It's built on top of **C.Messenger**, a UBL container that follows the UBL container pattern. Understanding this architecture is critical to making Messenger work properly.

---

## 🏗️ C.Messenger Container Structure

```
C.Messenger/
├── local/        → User intents (pre-TDLN, ephemeral)
├── boundary/     → TDLN layer (translates to ubl-link commits)
├── outbox/       → Drafts ready to commit
├── inbox/        → Events from ledger (SSE tail)
├── projections/  → Read-only derived state
├── pacts/        → Trust agreements
├── policy/       → Container policies
└── tests/        → Container tests
```

**Container Pattern Flow:**
```
[local] --draft--> [boundary] --signing_bytes--> [ubl-link] --(signature)--> [membrane]
                                                            \--Accept--> [ledger] --tail--> [projections]
```

---

## 🔄 Complete Data Flow

### 1. Send Message Flow

```
Frontend (ChatView)
  ↓ User types message, clicks Send
  ↓ POST /messenger/messages
  ↓ { conversation_id, content, message_type }
  
UBL Kernel (messenger_v1.rs)
  ↓ Get user from session (WebAuthn token)
  ↓ Generate message_id (msg_xxx)
  ↓ Hash content (BLAKE3) → content_hash
  ↓ Build canonical atom:
  {
    "type": "message.created",
    "id": "msg_xxx",
    "conversation_id": "conv_xxx",
    "from": "user_sid",
    "content_hash": "blake3_hash",
    "message_type": "text",
    "created_at": "ISO8601"
  }
  ↓ Canonicalize JSON (sort keys lexicographically)
  ↓ Generate atom_hash (BLAKE3 of canonical bytes)
  ↓ Get C.Messenger container state (sequence, previous_hash)
  ↓ Build ubl-link:
  {
    "version": 1,
    "container_id": "C.Messenger",
    "expected_sequence": sequence + 1,
    "previous_hash": "...",
    "atom_hash": "...",
    "atom": {...},
    "intent_class": "Observation",
    "physics_delta": "0",
    "author_pubkey": "user_sid",
    "signature": "..." (placeholder in current impl)
  }
  ↓ POST /link/commit (internal)
  ↓ Membrane validates
  ↓ Ledger accepts → append to ledger_entry
  ↓ Store actual content in message_content table (privacy)
  ↓ Return { message_id, hash, sequence }
  
Projection System (messages.rs)
  ↓ SSE tail: /ledger/C.Messenger/tail
  ↓ Event: message.created
  ↓ Update projection_messages table:
  INSERT INTO projection_messages (
    message_id, conversation_id, from_id, content_hash,
    timestamp, message_type, last_event_hash, last_event_seq
  )
  ↓ Projection ready for queries
  
Frontend
  ↓ Receives response
  ↓ Updates UI (optimistic update confirmed)
  ↓ Can query projection for latest state
```

### 2. Bootstrap Flow (Initial Load)

```
Frontend (ChatPage)
  ↓ GET /messenger/bootstrap
  
UBL Kernel (messenger_v1.rs)
  ↓ Get user from session → UserInfo
  ↓ Query projection_entities → EntityInfo[]
  ↓ Query projection_conversations → ConversationInfo[]
  ↓ Query projection_messages → MessageInfo[]
  ↓ Aggregate:
  {
    user: { sid, display_name, kind },
    entities: [...],
    conversations: [...],
    messages: [...]
  }
  ↓ Return JSON
  
Frontend
  ↓ Set state: entities, conversations, messages
  ↓ Render UI
```

### 3. Create Conversation Flow

```
Frontend (NewWorkstreamModal)
  ↓ User selects participants, enters name
  ↓ POST /messenger/conversations
  ↓ { name, participants, is_group }
  
UBL Kernel (messenger_v1.rs)
  ↓ Get user from session
  ↓ Generate conv_id (conv_xxx)
  ↓ Ensure user in participants list
  ↓ Sort participants (canonical order)
  ↓ Build canonical atom:
  {
    "type": "conversation.created",
    "id": "conv_xxx",
    "name": "...",
    "participants": ["sorted", "list"],
    "is_group": true/false,
    "created_by": "user_sid",
    "created_at": "ISO8601"
  }
  ↓ Canonicalize → atom_hash
  ↓ Build ubl-link → commit to C.Messenger
  ↓ Return { id, hash }
  
Projection System
  ↓ SSE tail receives conversation.created
  ↓ Update projection_conversations table
  
Frontend
  ↓ Add conversation to state
  ↓ Navigate to /chat/:id
```

### 4. Job Approval Flow

```
Frontend (JobCardRenderer)
  ↓ User clicks "Approve"
  ↓ POST /messenger/jobs/:id/approve
  
UBL Kernel (messenger_v1.rs)
  ↓ Get user from session
  ↓ Query JobsProjection.get_pending_approvals(job_id)
  ↓ Find approval request
  ↓ Build canonical atom:
  {
    "type": "approval.decided",
    "approval_id": "...",
    "job_id": "...",
    "decided_by": "user_sid",
    "decision": "approved",
    "reason": "...",
    "decided_at": "ISO8601"
  }
  ↓ Commit to C.Jobs (NOT C.Messenger!)
  ↓ Return { job_id, decision, hash }
  
C.Jobs Container
  ↓ Receives approval.decided event
  ↓ Updates job status
  ↓ Triggers job execution (if approved)
  
Office App
  ↓ Monitors C.Jobs events
  ↓ Executes job
  ↓ Streams progress via WebSocket
  
Frontend
  ↓ Receives WebSocket update
  ↓ Updates job card status
```

---

## 📊 Database Schema

### Ledger Tables (UBL Kernel)

**ledger_entry** (append-only)
```sql
container_id TEXT
sequence BIGINT (monotonic)
entry_hash TEXT (BLAKE3)
link_hash TEXT
ts_unix_ms BIGINT
```

**ledger_atom** (atom storage)
```sql
atom_hash TEXT PRIMARY KEY
atom_data JSONB (canonical JSON)
container_id TEXT
```

### C.Messenger Projection Tables

**projection_messages** (derived from message.created events)
```sql
message_id TEXT PRIMARY KEY
conversation_id TEXT
from_id TEXT
content_hash TEXT
timestamp TIMESTAMPTZ
message_type TEXT
read_by TEXT[]
last_event_hash TEXT
last_event_seq BIGINT
```

**projection_conversations** (derived from conversation.* events)
```sql
conversation_id TEXT PRIMARY KEY
name TEXT
is_group BOOLEAN
participants TEXT[]
created_by TEXT
created_at TIMESTAMPTZ
last_message_id TEXT
last_message_at TIMESTAMPTZ
last_event_hash TEXT
last_event_seq BIGINT
```

**projection_entities** (derived from entity.registered events)
```sql
entity_id TEXT PRIMARY KEY
display_name TEXT
entity_type TEXT
avatar_hash TEXT
status TEXT
registered_at TIMESTAMPTZ
last_event_hash TEXT
last_event_seq BIGINT
```

### Content Storage (Privacy)

**message_content** (actual content, not in ledger)
```sql
message_id TEXT PRIMARY KEY
content TEXT (actual message text)
content_hash TEXT (matches ledger hash)
created_at TIMESTAMPTZ
```

**Why separate?** The ledger stores only `content_hash` for privacy. The actual content is stored separately and can be retrieved by hash.

---

## 🔌 Event Types (C.Messenger)

All events follow SPEC-UBL-ATOM v1.0 canonicalization rules.

### message.created
```json
{
  "type": "message.created",
  "id": "msg_xxx",
  "conversation_id": "conv_xxx",
  "from": "user_sid",
  "content_hash": "blake3_hash",
  "message_type": "text|system|job_card|file",
  "created_at": "ISO8601"
}
```

### conversation.created
```json
{
  "type": "conversation.created",
  "id": "conv_xxx",
  "name": "...",
  "participants": ["sorted", "list"],
  "is_group": true,
  "created_by": "user_sid",
  "created_at": "ISO8601"
}
```

### conversation.participant_added
```json
{
  "type": "conversation.participant_added",
  "conversation_id": "conv_xxx",
  "participant_id": "user_sid",
  "added_by": "user_sid",
  "added_at": "ISO8601"
}
```

### message.read
```json
{
  "type": "message.read",
  "message_id": "msg_xxx",
  "read_by": "user_sid",
  "read_at": "ISO8601"
}
```

### entity.registered
```json
{
  "type": "entity.registered",
  "id": "entity_sid",
  "display_name": "...",
  "entity_type": "person|agent|system",
  "avatar_hash": "...",
  "registered_at": "ISO8601"
}
```

---

## 🔄 Projection System

### How Projections Work

1. **Event Source**: Ledger entries (append-only)
2. **Processing**: SSE tail `/ledger/C.Messenger/tail`
3. **Projection**: `MessagesProjection.process_event()`
4. **Storage**: PostgreSQL projection tables
5. **Query**: Fast reads from projections (not ledger)

### Projection Rebuild

On startup or corruption:
```rust
rebuild_projections(pool)
  ↓ Query all ledger_atom entries
  ↓ Filter by container_id = "C.Messenger"
  ↓ Process each event in sequence order
  ↓ Update projection tables
  ↓ Update projection_state (last_sequence, last_hash)
```

### Real-time Updates

**SSE Tail:**
```
GET /ledger/C.Messenger/tail
↓ Streams new entries as they're committed
↓ Frontend can subscribe for real-time updates
↓ Updates projections automatically
```

**WebSocket (for jobs):**
```
WS /ws
↓ Job-specific events (JobUpdate, JobComplete, ApprovalNeeded)
↓ Not for messages (messages use SSE tail)
```

---

## 🔗 Integration with Office

### How Office Reads Messages

Office doesn't directly query C.Messenger. Instead:

1. **SSE Tail**: Office subscribes to `/ledger/C.Messenger/tail`
2. **Event Processing**: Office processes `message.created` events
3. **Context Building**: Messages become part of LLM context
4. **Job Creation**: Office can create jobs in C.Jobs based on messages

### Office → Messenger Flow

```
Office (Job Executor)
  ↓ Job completes
  ↓ Commits job.completed to C.Jobs
  ↓ WebSocket: JobComplete event
  ↓ Frontend receives update
  ↓ Updates job card status
```

### Messenger → Office Flow

```
Frontend
  ↓ User sends message with job request
  ↓ Commits message.created to C.Messenger
  ↓ Office SSE tail receives event
  ↓ Office analyzes message
  ↓ Office creates job in C.Jobs
  ↓ Job card appears in Messenger
```

---

## 🛠️ Implementation Details

### Canonicalization Rules

All atoms MUST follow SPEC-UBL-ATOM v1.0:

1. **Key Sorting**: All keys sorted lexicographically (UTF-8 byte order)
2. **No Prohibited Fields**: No `container_id`, `signature`, `sequence`, `policy`
3. **Canonical Types**: Only JSON types (string, number, boolean, array, object)
4. **Timestamps**: ISO 8601 UTC strings
5. **Numbers**: Finite only (no NaN, Infinity)
6. **Compact**: No extra whitespace

**Example:**
```json
// ❌ Wrong (keys not sorted)
{
  "id": "msg_001",
  "type": "message.created",
  "from": "user_001"
}

// ✅ Correct (keys sorted)
{
  "from": "user_001",
  "id": "msg_001",
  "type": "message.created"
}
```

### Hashing

- **Content Hash**: BLAKE3 of message content (for privacy)
- **Atom Hash**: BLAKE3 of canonicalized atom bytes
- **Entry Hash**: BLAKE3 of link (includes previous_hash, sequence)

### Sequence Numbers

- **Monotonic**: Always increasing per container
- **Conflict Detection**: `expected_sequence` must match current state
- **Concurrency**: Optimistic locking via sequence check

### Signatures (Current State)

Currently using placeholder signatures. In production:
- User's passkey signs the link
- Or delegated agent signs on behalf of user
- Signature validates `author_pubkey` → `atom_hash`

---

## 🚨 Critical Points for Frontend

### 1. Content Storage

**Problem**: Ledger stores only `content_hash`, not actual content.

**Solution**: 
- `message_content` table stores actual content
- Frontend queries projection → gets `content_hash`
- Frontend queries `message_content` → gets actual content
- Or: Frontend stores content locally after sending

**Current Implementation:**
```rust
// messenger_v1.rs stores content separately
store_message_content(pool, message_id, content, content_hash).await

// Retrieval
get_message_content(pool, message_id).await
```

### 2. Real-time Updates

**Current**: Only jobs have WebSocket updates.

**Missing**: Real-time message delivery.

**Solution Options:**
1. **SSE Tail**: Frontend subscribes to `/ledger/C.Messenger/tail`
2. **WebSocket**: Add message events to existing `/ws` endpoint
3. **Polling**: Poll `/messenger/bootstrap` periodically (not ideal)

**Recommended**: SSE Tail for messages (matches UBL pattern)

### 3. Conversation State

**Current**: Conversations derived from messages (not ideal).

**Better**: Use `projection_conversations` table.

**Current Query** (messenger_v1.rs):
```rust
// Derives conversations from messages
SELECT DISTINCT ON (conversation_id)
    conversation_id as id,
    ...
FROM projection_messages
```

**Should Be**:
```rust
// Query projection_conversations directly
SELECT * FROM projection_conversations
WHERE $1 = ANY(participants)
```

### 4. Entity Registration

**Current**: Entities come from `id_subjects` table.

**Better**: Use `projection_entities` (derived from `entity.registered` events).

**Current Query**:
```rust
SELECT sid as id, display_name, kind, ...
FROM id_subjects
WHERE kind IN ('person', 'llm', 'app')
```

**Should Be**:
```rust
SELECT * FROM projection_entities
WHERE entity_type IN ('person', 'agent', 'system')
```

---

## 📋 Complete API Endpoint Mapping

### Frontend → UBL Kernel

| Frontend Call | Endpoint | Container | Event Type | Projection |
|---------------|----------|-----------|------------|------------|
| `ublApi.bootstrap()` | `GET /messenger/bootstrap` | - | - | Queries projections |
| `ublApi.sendMessage()` | `POST /messenger/messages` | C.Messenger | `message.created` | `projection_messages` |
| `ublApi.createConversation()` | `POST /messenger/conversations` | C.Messenger | `conversation.created` | `projection_conversations` |
| `ublApi.approveJob()` | `POST /messenger/jobs/:id/approve` | C.Jobs | `approval.decided` | `projection_jobs` |
| `ublApi.rejectJob()` | `POST /messenger/jobs/:id/reject` | C.Jobs | `approval.decided` | `projection_jobs` |
| `ublApi.listEntities()` | `GET /messenger/entities` | - | - | `projection_entities` |
| `ublApi.listConversations()` | `GET /messenger/conversations` | - | - | `projection_conversations` |

### Real-time Subscriptions

| Frontend Call | Endpoint | Container | Purpose |
|---------------|----------|-----------|---------|
| `jobsApi.subscribe()` | `WS /ws` | C.Jobs | Job updates |
| (Missing) | `SSE /ledger/C.Messenger/tail` | C.Messenger | Message updates |

---

## 🔧 What Needs to Be Fixed

### 1. Real-time Message Delivery

**Current**: Messages only appear after refresh.

**Fix**: Frontend subscribes to SSE tail:
```typescript
const eventSource = new EventSource('/ledger/C.Messenger/tail');
eventSource.onmessage = (event) => {
  const entry = JSON.parse(event.data);
  if (entry.atom.type === 'message.created') {
    // Update UI with new message
  }
};
```

### 2. Conversation Projection

**Current**: Conversations derived from messages.

**Fix**: Update `messenger_v1.rs` to use `projection_conversations`:
```rust
// Instead of deriving from messages
SELECT * FROM projection_conversations
WHERE $1 = ANY(participants)
ORDER BY last_message_at DESC
```

### 3. Entity Projection

**Current**: Entities from `id_subjects`.

**Fix**: Use `projection_entities`:
```rust
SELECT * FROM projection_entities
WHERE entity_type IN ('person', 'agent', 'system')
```

### 4. Content Retrieval

**Current**: Content stored separately, but retrieval not optimized.

**Fix**: Add endpoint or optimize query:
```rust
// In bootstrap, join with message_content
SELECT m.*, mc.content
FROM projection_messages m
LEFT JOIN message_content mc ON m.message_id = mc.message_id
WHERE m.conversation_id = $1
```

### 5. Signature Implementation

**Current**: Placeholder signatures.

**Fix**: Implement WebAuthn signing:
```rust
// Get user's passkey
let credential = get_user_credential(user_sid).await?;

// Sign atom_hash with passkey
let signature = sign_with_passkey(&credential, &atom_hash).await?;

// Use real signature in link
link.signature = signature;
```

---

## 🎯 Summary: How Messenger Works

1. **Frontend** sends semantic requests (`/messenger/*`)
2. **UBL Kernel** (`messenger_v1.rs`) translates to canonical atoms
3. **UBL Kernel** commits atoms to ledger as ubl-links
4. **Ledger** stores events in `ledger_entry` + `ledger_atom`
5. **Projection System** processes events via SSE tail
6. **Projection Tables** store derived state (fast queries)
7. **Frontend** queries projections for UI state
8. **Real-time**: SSE tail streams new events to frontend

**Key Insight**: Messenger is **not** a traditional database-backed app. It's an **event-sourced** system built on UBL's immutable ledger. All mutations are events, all queries are projections.

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Deep Dive Complete

