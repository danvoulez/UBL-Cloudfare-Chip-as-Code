# UBL Messenger - Complete Frontend Specification

> **Complete mapping of endpoints, components, data flows, and requirements for a messenger frontend**

---

## Table of Contents

1. [API Endpoints Inventory](#api-endpoints-inventory)
2. [Component Hierarchy](#component-hierarchy)
3. [Data Flow Architecture](#data-flow-architecture)
4. [UI Components & Interactions](#ui-components--interactions)
5. [Real-time Events](#real-time-events)
6. [Frontend Requirements Menu](#frontend-requirements-menu)

---

## API Endpoints Inventory

### Authentication Endpoints (`/id/*`)

| Endpoint | Method | Purpose | Status | Request Body | Response |
|----------|--------|---------|--------|--------------|----------|
| `/id/register/begin` | POST | Start WebAuthn registration | ✅ Implemented | `{ username, display_name }` | `{ challenge_id, options }` |
| `/id/register/finish` | POST | Complete WebAuthn registration | ✅ Implemented | `{ challenge_id, attestation }` | `{ sid }` |
| `/id/login/begin` | POST | Start WebAuthn authentication | ✅ Implemented | `{ username }` | `{ challenge_id, public_key }` |
| `/id/login/finish` | POST | Complete WebAuthn authentication | ✅ Implemented | `{ challenge_id, credential }` | `{ sid, session_token }` |
| `/id/whoami` | GET | Get current user info | ✅ Implemented | - | `{ sid, display_name, kind, authenticated }` |
| `/id/logout` | POST | Logout (clear session) | ❌ Missing | - | `{ ok: true }` |

**Headers Required:**
- `Authorization: Bearer {session_token}` (for authenticated endpoints)

---

### Messenger Core Endpoints (`/messenger/*`)

| Endpoint | Method | Purpose | Status | Request Body | Response |
|----------|--------|---------|--------|--------------|----------|
| `/messenger/bootstrap` | GET | Get initial app state | ✅ Implemented | - | `{ user, entities, conversations, messages }` |
| `/messenger/entities` | GET | List all entities | ✅ Implemented | - | `Entity[]` |
| `/messenger/conversations` | GET | List conversations | ✅ Implemented | - | `Conversation[]` |
| `/messenger/conversations` | POST | Create conversation/workstream | ✅ Implemented | `{ participants, name?, is_group? }` | `{ id, hash }` |
| `/messenger/messages` | POST | Send message | ✅ Implemented | `{ conversation_id, content, message_type? }` | `{ message_id, hash, sequence }` |
| `/messenger/jobs/:id/approve` | POST | Approve job | ✅ Implemented | `{ reason? }` | `{ job_id, decision, hash }` |
| `/messenger/jobs/:id/reject` | POST | Reject job | ✅ Implemented | `{ reason? }` | `{ job_id, decision, hash }` |

---

### Jobs API Endpoints (`/api/jobs/*`)

| Endpoint | Method | Purpose | Status | Request Body | Response |
|----------|--------|---------|--------|--------------|----------|
| `/api/jobs` | GET | List jobs | 🟡 Partial | `?conversation_id=&status=&page=&limit=` | `{ jobs, total, page, limit }` |
| `/api/jobs` | POST | Create job | ❌ Missing | `{ conversation_id, title, description?, priority? }` | `Job` |
| `/api/jobs/:id` | GET | Get job details | 🟡 Partial | - | `Job` |
| `/api/jobs/:id/approve` | POST | Approve job | ✅ Via `/messenger/jobs/:id/approve` | - | `Job` |
| `/api/jobs/:id/reject` | POST | Reject job | ✅ Via `/messenger/jobs/:id/reject` | `{ reason? }` | `Job` |
| `/api/jobs/:id/cancel` | POST | Cancel running job | ❌ Missing | - | `Job` |
| `/api/jobs/:id/approvals` | GET | Get pending approvals | 🟡 Partial | - | `ApprovalRequest[]` |
| `/api/jobs/:id/approvals/:approvalId` | POST | Respond to approval | ❌ Missing | `{ decision, comment? }` | - |

---

### WebSocket/SSE Endpoints

| Endpoint | Protocol | Purpose | Status | Events |
|----------|----------|---------|--------|--------|
| `/ws` | WebSocket | Real-time job updates | 🟡 Partial | `JobUpdate`, `JobComplete`, `ApprovalNeeded` |
| `/ledger/:container/tail` | SSE | Ledger stream | ✅ Available | Raw ledger entries |

**WebSocket Events:**
- `JobUpdate`: `{ type: 'JobUpdate', payload: { job_id, status, progress, current_step } }`
- `JobComplete`: `{ type: 'JobComplete', payload: { job_id, summary, artifact_count } }`
- `ApprovalNeeded`: `{ type: 'ApprovalNeeded', payload: { job_id, action, reason } }`
- `Connected`: `{ type: 'Connected', payload: { session_id } }`
- `Ping`/`Pong`: Keep-alive

**Missing Events:**
- `NewMessage`: Real-time message delivery
- `PresenceUpdate`: Online/offline status changes
- `TypingIndicator`: User typing status

---

### Health & Utility Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/health` | GET | Health check | ✅ Available |
| `/ledger/:container/tail` | GET | Stream ledger entries | ✅ Available |
| `/state/:container_id` | GET | Get container state | ✅ Available |
| `/atom/:hash` | GET | Get atom by hash | ✅ Available |

---

## Component Hierarchy

```
App (Root)
├── ErrorBoundary
├── BrowserRouter
│   └── AuthProvider
│       └── ToastProvider
│           └── Routes
│               ├── /login → LoginPage (PublicRoute)
│               ├── / → ChatPage (ProtectedRoute)
│               ├── /chat/:conversationId? → ChatPage (ProtectedRoute)
│               └── /settings → SettingsPage (ProtectedRoute)
│
ChatPage (Main Interface)
├── Sidebar
│   ├── User Header (Profile, Status, Actions)
│   ├── Search Input
│   ├── Conversations List
│   └── Footer (Version, Status)
├── ChatView (when conversation selected)
│   ├── Header (Avatar, Name, Actions)
│   ├── Messages List
│   │   ├── Message Bubbles
│   │   ├── JobCardRenderer (inline)
│   │   └── Typing Indicator
│   └── Input Footer (Attach, Textarea, Send)
├── WelcomeScreen (when no conversation)
│   ├── Logo & Greeting
│   ├── Recent Conversations
│   ├── Action Buttons
│   └── Stats
└── Modals
    ├── NewWorkstreamModal
    └── EntityProfileModal
```

---

## Data Flow Architecture

### 1. Authentication Flow

```
LoginPage
  ↓ (user clicks "Sign in with Passkey")
useAuth.loginWithPasskey(username)
  ↓ POST /id/login/begin
  ↓ (browser WebAuthn prompt)
startAuthentication(public_key)
  ↓ POST /id/login/finish
  ↓ localStorage.setItem('ubl_session_token', token)
AuthContext.setUser({ sid, username, displayName })
  ↓ navigate('/')
ChatPage loads
```

### 2. Bootstrap Flow (Initial Load)

```
ChatPage (mount)
  ↓ useEffect
  ↓ ublApi.bootstrap()
  ↓ GET /messenger/bootstrap
  ↓ Response: { user, entities, conversations, messages }
  ↓ setEntities(entities)
  ↓ setConversations(conversations)
  ↓ setMessages(messages)
  ↓ Render UI
```

### 3. Send Message Flow

```
ChatView (user types message)
  ↓ handleSendMessage(content)
  ↓ Optimistic UI: add temp message with status='pending'
  ↓ ublApi.sendMessage({ conversationId, content, type: 'chat' })
  ↓ POST /messenger/messages
  ↓ Backend commits to C.Messenger ledger
  ↓ Response: { messageId, hash, sequence }
  ↓ Update message: replace tempId with real messageId, status='sent'
  ↓ Update conversation: lastMessage, lastMessageTime
```

### 4. Create Conversation Flow

```
Sidebar (user clicks "+" button)
  ↓ setIsNewWorkstreamOpen(true)
  ↓ NewWorkstreamModal opens
  ↓ User selects participants / creates group
  ↓ handleCreateWorkstream({ name, participants, isGroup })
  ↓ ublApi.createConversation({ participants, name, isGroup })
  ↓ POST /messenger/conversations
  ↓ Response: { id, hash }
  ↓ Add to conversations state
  ↓ navigate(`/chat/${id}`)
```

### 5. Job Approval Flow

```
ChatView (JobCardRenderer displays job card)
  ↓ User clicks "Approve" button
  ↓ handleApprove()
  ↓ ublApi.approveJob(jobId)
  ↓ POST /messenger/jobs/:id/approve
  ↓ Backend commits approval to C.Jobs ledger
  ↓ Response: { job_id, decision, hash }
  ↓ Update job card status to 'running'
  ↓ Optional: Send confirmation message
```

### 6. Real-time Updates Flow

```
ChatPage (mount)
  ↓ useEffect
  ↓ jobsApi.subscribe((event) => { ... })
  ↓ jobsApi.connect()
  ↓ WebSocket connection to /ws
  ↓ Server sends: JobUpdate, JobComplete, ApprovalNeeded
  ↓ Handler updates local state
  ↓ UI re-renders with new data
```

---

## UI Components & Interactions

### LoginPage (`/login`)

**Components:**
- Logo (UBL Shield icon)
- Mode Tabs (Sign In / Register)
- Username Input
- Display Name Input (register mode only)
- Passkey Button (Sign in / Create Passkey)
- Demo Mode Button

**Interactions:**
- ✅ Tab switching (login ↔ register)
- ✅ Passkey registration flow
- ✅ Passkey authentication flow
- ✅ Demo mode (localStorage flag)
- ❌ Password fallback (not implemented)

**Data Sources:**
- `useAuth()` hook
- `AuthContext` for session state

---

### Sidebar Component

**Components:**
- User Header
  - Avatar (clickable → EntityProfileModal)
  - Status indicator (clickable → toggle status)
  - Name & Role
- Action Buttons
  - ➕ New Workstream (opens modal)
  - ⚙️ Settings (opens modal)
  - 🚪 Logout (clears session)
- Search Input (filters conversations)
- Conversations List
  - Avatar/Icon
  - Name
  - Last message preview
  - Timestamp
  - Unread badge
- Footer
  - Version info
  - Live status indicator

**Interactions:**
- ✅ Click conversation → navigate to `/chat/:id`
- ✅ Click user avatar → open EntityProfileModal
- ✅ Click status → toggle (demo only, not persisted)
- ✅ Search → filter conversations locally
- ✅ New Workstream → open NewWorkstreamModal
- ✅ Logout → clear session, navigate to `/login`

**Data Sources:**
- `conversations` prop (from ChatPage state)
- `entities` prop (from ChatPage state)
- `currentUser` prop (from AuthContext)

---

### ChatView Component

**Components:**
- Header
  - Back button (mobile only)
  - Avatar (clickable → EntityProfileModal)
  - Name & Subtitle
  - Call button (stub, no functionality)
  - More button (stub, no functionality)
- Messages List
  - Message bubbles (sent/received)
  - Avatar (for received messages)
  - Sender name (for received messages)
  - Content (text, code blocks, job cards)
  - Timestamp & hash
  - Status indicator (pending/sent/failed)
  - Typing indicator
- Input Footer
  - Attach button (stub, no functionality)
  - Textarea (multi-line input)
  - Send button (disabled when empty)
  - Ledger sync status

**Interactions:**
- ✅ Send message (Enter or Send button)
- ✅ Auto-scroll to bottom on new messages
- ✅ Click avatar → open EntityProfileModal
- ✅ Render job cards inline
- ✅ Display message hash
- ❌ File attachment (not implemented)
- ❌ Emoji picker (not implemented)
- ❌ Voice message (not implemented)

**Data Sources:**
- `messages` prop (filtered by conversation)
- `conversation` prop
- `entities` prop (for sender info)
- `currentUser` prop

---

### JobCardRenderer Component

**Components:**
- Header
  - Status icon (⏳🔄✅❌)
  - Job ID
  - Title
  - Status badge
- Description
- Progress bar (if running)
- Metadata items (key-value pairs)
- Amount badge (if present)
- Duration
- Action buttons (Approve/Reject if pending)
- View Result button (if completed)

**Interactions:**
- ✅ Approve → `ublApi.approveJob()` → POST `/messenger/jobs/:id/approve`
- ✅ Reject → `ublApi.rejectJob()` → POST `/messenger/jobs/:id/reject`
- ✅ View Result → open URL in new tab
- ✅ Status updates via WebSocket

**Data Sources:**
- `card` prop (JobCardData)
- WebSocket events for status updates

---

### NewWorkstreamModal Component

**Components:**
- Mode Toggle (Direct / Group)
- Group Name Input (group mode only)
- Entity List (selectable)
- Create Button (group mode only)

**Interactions:**
- ✅ Direct mode: select entity → create conversation immediately
- ✅ Group mode: select multiple entities → enter name → create group
- ✅ Close modal (X button or backdrop click)

**Data Sources:**
- `entities` prop (filtered to exclude current user)

---

### EntityProfileModal Component

**Components:**
- Avatar (large)
- Status indicator
- Name & Role
- Stats (Trust, Active Hours, Jobs)
- Bio
- Start Conversation button

**Interactions:**
- ✅ Start Conversation → `onStartChat(entityId)` → create/find conversation
- ✅ Close modal

**Data Sources:**
- `entity` prop

---

### WelcomeScreen Component

**Components:**
- Logo
- Greeting (user name)
- Recent Conversations (up to 3)
- New Workstream button
- Protocol Settings button (optional)
- Stats (Workstreams, AI Agents, Humans)

**Interactions:**
- ✅ Click recent conversation → navigate to chat
- ✅ New Workstream → `onNewConversation()`
- ✅ Protocol Settings → `onOpenSettings()` (if provided)

**Data Sources:**
- `conversations` prop (slice(0, 3))
- `entities` prop (for stats)

---

### SettingsPage (`/settings`)

**Components:**
- Profile Section
  - Avatar
  - Name & SID
  - Edit button (stub)
- Appearance Section
  - Dark Mode toggle (local only)
  - Glow Intensity slider (local only)
- Notifications Section
  - Push Notifications toggle (local only)
  - Sounds toggle (local only)
- Security Section
  - Passkeys management (stub: "Coming soon")
  - Connected Services (stub: "Coming soon")
- Logout button

**Interactions:**
- ✅ Toggle settings (local state only, not persisted)
- ✅ Logout → clear session, navigate to `/login`
- ❌ Edit Profile (not implemented)
- ❌ Passkeys management (not implemented)

**Data Sources:**
- `useAuthContext()` for user info
- Local state for settings

---

## Real-time Events

### WebSocket Connection

**Connection:**
- URL: `ws://{host}/ws` or `wss://{host}/ws`
- Auto-reconnect on disconnect (3s delay)
- Ping/Pong keep-alive

**Subscribed Events:**

1. **JobUpdate**
   ```typescript
   {
     type: 'JobUpdate',
     payload: {
       job_id: string,
       status: string,
       progress: number,
       current_step: string | null
     }
   }
   ```
   → Updates job card progress/status

2. **JobComplete**
   ```typescript
   {
     type: 'JobComplete',
     payload: {
       job_id: string,
       summary: string,
       artifact_count: number
     }
   }
   ```
   → Marks job as completed, shows result

3. **ApprovalNeeded**
   ```typescript
   {
     type: 'ApprovalNeeded',
     payload: {
       job_id: string,
       action: string,
       reason: string
     }
   }
   ```
   → Shows approval request (UI not fully wired)

**Missing Events (Not Implemented):**

- `NewMessage`: Real-time message delivery
- `PresenceUpdate`: Online/offline status
- `TypingIndicator`: User typing status
- `ConversationUpdate`: Conversation metadata changes

---

## Frontend Requirements Menu

### ✅ Core Features (Required)

#### 1. Authentication System
- [x] WebAuthn passkey registration
- [x] WebAuthn passkey authentication
- [x] Session token management (localStorage)
- [x] Session validation on app load
- [x] Demo mode (no backend required)
- [ ] Logout endpoint call
- [ ] Password fallback (optional)

#### 2. Conversation Management
- [x] List conversations/workstreams
- [x] Create direct conversation
- [x] Create group conversation
- [x] Search/filter conversations
- [x] Display last message preview
- [x] Display unread count
- [x] Display timestamps
- [ ] Delete conversation
- [ ] Archive conversation
- [ ] Pin conversation

#### 3. Messaging
- [x] Send text messages
- [x] Display message history
- [x] Message status indicators (pending/sent/failed)
- [x] Message hash display
- [x] Optimistic UI updates
- [x] Auto-scroll to bottom
- [x] Typing indicator (simulated)
- [ ] File attachments
- [ ] Image preview
- [ ] Code syntax highlighting
- [ ] Message reactions
- [ ] Message editing
- [ ] Message deletion
- [ ] Read receipts
- [ ] Real-time message delivery (WebSocket)

#### 4. Entity Management
- [x] Display entities (humans, agents, systems)
- [x] Entity profiles (avatar, name, role, bio)
- [x] Entity status (online/offline/away/busy)
- [x] Start conversation from entity profile
- [ ] Entity search
- [ ] Entity blocking
- [ ] Entity presence updates (WebSocket)

#### 5. Job Cards
- [x] Display job cards inline in messages
- [x] Job status indicators
- [x] Progress bars
- [x] Approve button
- [x] Reject button
- [x] View result button
- [x] Real-time job updates (WebSocket)
- [ ] Job cancellation
- [ ] Job logs viewer
- [ ] Job artifacts download

#### 6. UI/UX
- [x] Responsive design (mobile/desktop)
- [x] Dark theme
- [x] Loading states
- [x] Error handling
- [x] Toast notifications
- [x] Modal dialogs
- [x] Smooth animations (framer-motion)
- [x] Custom scrollbars
- [ ] Light theme toggle
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] PWA support (offline mode)

---

### 🟡 Enhanced Features (Recommended)

#### 7. File Management
- [ ] File upload to MinIO/S3
- [ ] File preview (images, PDFs)
- [ ] File download
- [ ] File sharing
- [ ] Vault storage integration

#### 8. Search
- [x] Conversation search (local filter)
- [ ] Global message search
- [ ] Entity search
- [ ] Job search
- [ ] Full-text search with highlighting

#### 9. Settings & Preferences
- [x] Appearance settings (local only)
- [x] Notification preferences (local only)
- [ ] Settings persistence (backend)
- [ ] Profile editing
- [ ] Passkey management
- [ ] Connected services status
- [ ] Theme customization

#### 10. Real-time Features
- [x] Job updates (WebSocket)
- [ ] Message delivery (WebSocket)
- [ ] Presence updates (WebSocket)
- [ ] Typing indicators (WebSocket)
- [ ] Notification badges
- [ ] Desktop notifications

---

### 🔴 Advanced Features (Optional)

#### 11. Rich Content
- [ ] Code blocks with syntax highlighting
- [ ] Markdown rendering
- [ ] LaTeX math rendering
- [ ] Embedded media (YouTube, etc.)
- [ ] Interactive forms
- [ ] Polls

#### 12. Collaboration
- [ ] Shared workspaces
- [ ] Threaded conversations
- [ ] Mentions (@user)
- [ ] Reactions (emoji)
- [ ] Pinned messages
- [ ] Shared files/folders

#### 13. Analytics & Insights
- [ ] Message statistics
- [ ] Job completion rates
- [ ] Entity activity metrics
- [ ] Trust score visualization
- [ ] Ledger audit trail viewer

#### 14. Integration
- [ ] Webhook support
- [ ] API key management
- [ ] Third-party integrations
- [ ] Export data (JSON, CSV)
- [ ] Import data

---

## Technical Stack Requirements

### Dependencies

**Core:**
- React 18.3+
- React Router 6.28+
- TypeScript 5.6+

**UI:**
- Tailwind CSS 3.4+
- Framer Motion 11.15+
- Lucide React (icons)
- React Hot Toast (notifications)

**Authentication:**
- @simplewebauthn/browser 11.0+

**Utilities:**
- date-fns (date formatting)
- clsx (conditional classes)

### Build Tools

- Vite 6.0+
- TypeScript compiler
- ESLint
- Prettier
- PostCSS + Autoprefixer

### Environment Variables

```bash
VITE_API_BASE_URL=http://localhost:8080  # UBL Server URL
VITE_TENANT_ID=T.UBL                      # Tenant ID
VITE_RUNNER_TARGET=LAB_512                # Runner target
```

### Browser Support

- Chrome/Edge (WebAuthn support required)
- Firefox (WebAuthn support required)
- Safari (WebAuthn support required)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Data Models

### Entity
```typescript
{
  id: string;
  name: string;
  avatar: string;
  type: 'human' | 'agent' | 'system';
  status?: 'online' | 'offline' | 'away' | 'busy';
  role?: string;
  bio?: string;
  trustScore?: number;
}
```

### Conversation
```typescript
{
  id: string;
  participants: string[];
  isGroup: boolean;
  name?: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}
```

### Message
```typescript
{
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'failed';
  hash: string;
  type: 'chat' | 'command' | 'agreement' | 'system_alert';
  parts?: MessagePart[];
}
```

### JobCardData
```typescript
{
  id: string;
  type: 'initiation' | 'progress' | 'completion' | 'approval';
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  duration?: string;
  metadata?: {
    items?: { label: string; value: string }[];
    amount?: string;
    resultUrl?: string;
  };
}
```

---

## State Management

### Global State (Context)

1. **AuthContext**
   - User session
   - Authentication state
   - Login/logout functions

2. **ThemeContext** (if implemented)
   - Theme preferences
   - Color scheme

3. **NotificationContext** (if implemented)
   - Notification queue
   - Notification preferences

### Local State (Component)

- `ChatPage`: conversations, entities, messages, UI state
- `ChatView`: input text, typing state
- `Sidebar`: search query
- `NewWorkstreamModal`: mode, selected participants, group name
- `SettingsPage`: settings toggles

### Data Fetching

- **Initial Load**: `ublApi.bootstrap()` → single call for all data
- **Send Message**: `ublApi.sendMessage()` → optimistic update + API call
- **Create Conversation**: `ublApi.createConversation()` → API call + state update
- **Job Actions**: `ublApi.approveJob()` / `ublApi.rejectJob()` → API call + state update

---

## Error Handling

### Network Errors
- Retry logic (3 attempts, exponential backoff)
- Toast notifications for user feedback
- Fallback to demo mode if API unavailable

### Authentication Errors
- Redirect to `/login` on 401/403
- Clear invalid session tokens
- Show error messages

### Validation Errors
- Form validation (required fields)
- Input sanitization
- Error messages inline

---

## Performance Considerations

### Code Splitting
- Lazy loading for pages (React.lazy)
- Route-based code splitting

### Optimizations
- Optimistic UI updates
- Debounced search
- Virtualized message list (if needed)
- Image lazy loading

### Caching
- Session token in localStorage
- API base URL in localStorage
- Demo mode flag in localStorage

---

## Security Considerations

### Authentication
- WebAuthn (passwordless, phishing-resistant)
- Session tokens (HTTP-only cookies recommended)
- Token expiration handling

### Data Protection
- HTTPS required for production
- Input sanitization
- XSS prevention (React escapes by default)
- CSRF protection (if needed)

### Privacy
- No sensitive data in localStorage (except session token)
- Clear data on logout
- Demo mode doesn't send real data

---

## Testing Requirements

### Unit Tests
- Component rendering
- Hook logic
- Utility functions

### Integration Tests
- API calls
- Authentication flow
- Message sending flow

### E2E Tests
- Complete user flows
- Cross-browser testing
- Mobile responsiveness

---

## Deployment Checklist

- [ ] Set `VITE_API_BASE_URL` environment variable
- [ ] Build production bundle (`npm run build`)
- [ ] Configure reverse proxy (if needed)
- [ ] Enable HTTPS
- [ ] Set up WebAuthn domain verification
- [ ] Configure CORS on backend
- [ ] Test WebSocket connection
- [ ] Verify all API endpoints are accessible
- [ ] Test authentication flow
- [ ] Test message sending/receiving
- [ ] Test job approval flow
- [ ] Verify real-time updates work

---

## Summary: What a Messenger Frontend Needs

### ✅ Must Have

1. **Authentication**: WebAuthn passkey support, session management
2. **Conversation List**: Display conversations, search, create new
3. **Message Display**: Show messages, send messages, status indicators
4. **Entity Profiles**: View entities, start conversations
5. **Job Cards**: Display jobs, approve/reject actions
6. **Real-time Updates**: WebSocket for job status changes
7. **Responsive UI**: Mobile and desktop support
8. **Error Handling**: Network errors, validation, user feedback

### 🟡 Should Have

1. **File Attachments**: Upload, preview, download
2. **Settings Persistence**: Save preferences to backend
3. **Real-time Messages**: WebSocket for new messages
4. **Presence**: Online/offline status
5. **Search**: Global message/entity search
6. **Rich Content**: Code blocks, markdown, media

### 🔴 Nice to Have

1. **Advanced Features**: Threads, reactions, mentions
2. **Analytics**: Statistics, metrics, insights
3. **Integrations**: Webhooks, API keys, third-party
4. **PWA**: Offline mode, installable app

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Production Ready (with known limitations)

