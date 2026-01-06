# UBL Messenger - Frontend Requirements Menu

> **Quick reference: What a messenger frontend needs to have**

---

## 📋 Complete Endpoint List

### Authentication (`/id/*`)
```
POST   /id/register/begin      → Start WebAuthn registration
POST   /id/register/finish     → Complete WebAuthn registration
POST   /id/login/begin         → Start WebAuthn authentication
POST   /id/login/finish        → Complete WebAuthn authentication
GET    /id/whoami              → Get current user info
POST   /id/logout              → Logout (missing)
```

### Messenger Core (`/messenger/*`)
```
GET    /messenger/bootstrap    → Get initial state (user, entities, conversations, messages)
GET    /messenger/entities    → List all entities
GET    /messenger/conversations → List conversations
POST   /messenger/conversations → Create conversation/workstream
POST   /messenger/messages     → Send message
POST   /messenger/jobs/:id/approve → Approve job
POST   /messenger/jobs/:id/reject → Reject job
```

### Jobs API (`/api/jobs/*`)
```
GET    /api/jobs               → List jobs (with filters)
POST   /api/jobs               → Create job (missing)
GET    /api/jobs/:id           → Get job details
POST   /api/jobs/:id/approve   → Approve job
POST   /api/jobs/:id/reject    → Reject job
POST   /api/jobs/:id/cancel    → Cancel job (missing)
GET    /api/jobs/:id/approvals → Get pending approvals
POST   /api/jobs/:id/approvals/:id → Respond to approval (missing)
```

### Real-time
```
WS     /ws                     → WebSocket for job updates
SSE    /ledger/:container/tail → Stream ledger entries
```

---

## 🎨 Component Hierarchy

```
App
├── LoginPage (/login)
│   ├── Passkey Registration
│   ├── Passkey Authentication
│   └── Demo Mode
│
├── ChatPage (/)
│   ├── Sidebar
│   │   ├── User Header (Profile, Status)
│   │   ├── Search
│   │   ├── Conversations List
│   │   └── Footer
│   │
│   ├── ChatView (when conversation selected)
│   │   ├── Header (Avatar, Name, Actions)
│   │   ├── Messages List
│   │   │   ├── Message Bubbles
│   │   │   ├── JobCardRenderer
│   │   │   └── Typing Indicator
│   │   └── Input Footer (Attach, Textarea, Send)
│   │
│   ├── WelcomeScreen (when no conversation)
│   │   ├── Recent Conversations
│   │   ├── Action Buttons
│   │   └── Stats
│   │
│   └── Modals
│       ├── NewWorkstreamModal
│       └── EntityProfileModal
│
└── SettingsPage (/settings)
    ├── Profile Section
    ├── Appearance Settings
    ├── Notifications
    ├── Security
    └── Logout
```

---

## 🔄 Data Flow Summary

### Authentication
```
User → LoginPage → WebAuthn → /id/login/begin → /id/login/finish 
→ Session Token → AuthContext → ChatPage
```

### Initial Load
```
ChatPage → /messenger/bootstrap → { user, entities, conversations, messages }
→ Set State → Render UI
```

### Send Message
```
User types → ChatView → Optimistic update → /messenger/messages 
→ Backend commits to ledger → Update message status
```

### Create Conversation
```
Sidebar "+" → NewWorkstreamModal → Select participants 
→ /messenger/conversations → Add to state → Navigate to chat
```

### Job Approval
```
JobCardRenderer → Approve button → /messenger/jobs/:id/approve 
→ Backend commits → Update job status → WebSocket notification
```

### Real-time Updates
```
WebSocket /ws → JobUpdate/JobComplete/ApprovalNeeded events 
→ Update local state → Re-render UI
```

---

## 🎯 All Buttons & Interactions

### LoginPage
- ✅ **Sign In Tab** → Switch to login mode
- ✅ **Register Tab** → Switch to register mode
- ✅ **Sign in with Passkey** → WebAuthn authentication
- ✅ **Create Passkey** → WebAuthn registration
- ✅ **Try Demo Mode** → Skip authentication

### Sidebar
- ✅ **User Avatar** → Open EntityProfileModal
- ✅ **Status Indicator** → Toggle status (demo only)
- ✅ **➕ New Workstream** → Open NewWorkstreamModal
- ✅ **⚙️ Settings** → Open EntityProfileModal (settings tab)
- ✅ **🚪 Logout** → Clear session, navigate to /login
- ✅ **Search Input** → Filter conversations locally
- ✅ **Conversation Item** → Navigate to /chat/:id

### ChatView Header
- ✅ **Back Button** (mobile) → Navigate back
- ✅ **Avatar** → Open EntityProfileModal
- ❌ **Call Button** → Stub (no functionality)
- ❌ **More Button** → Stub (no functionality)

### ChatView Messages
- ✅ **Message Bubble** → Display content
- ✅ **Job Card** → Render inline with actions
- ✅ **Approve Button** → POST /messenger/jobs/:id/approve
- ✅ **Reject Button** → POST /messenger/jobs/:id/reject
- ✅ **View Result** → Open URL in new tab

### ChatView Input
- ✅ **Send Button** → POST /messenger/messages
- ✅ **Enter Key** → Send message
- ❌ **Attach Button** → Stub (no functionality)
- ❌ **Emoji Picker** → Not implemented
- ❌ **Voice Message** → Not implemented

### NewWorkstreamModal
- ✅ **Direct Mode** → Select entity → Create conversation
- ✅ **Group Mode** → Select multiple → Enter name → Create group
- ✅ **Close (X)** → Close modal
- ✅ **Backdrop Click** → Close modal

### EntityProfileModal
- ✅ **Start Conversation** → Create/find conversation → Navigate
- ✅ **Close (X)** → Close modal
- ✅ **Backdrop Click** → Close modal

### WelcomeScreen
- ✅ **Recent Conversation** → Navigate to chat
- ✅ **New Workstream** → Open NewWorkstreamModal
- ❌ **Protocol Settings** → Not wired (prop optional)

### SettingsPage
- ✅ **Dark Mode Toggle** → Local state only
- ✅ **Glow Intensity Slider** → Local state only
- ✅ **Notifications Toggle** → Local state only
- ✅ **Sounds Toggle** → Local state only
- ❌ **Edit Profile** → Stub (no functionality)
- ❌ **Passkeys Management** → Stub ("Coming soon")
- ❌ **Connected Services** → Stub ("Coming soon")
- ✅ **Logout** → Clear session, navigate to /login

---

## 📊 Data Hierarchy

### Top Level
```
App State
├── AuthContext (Global)
│   ├── user: { sid, username, displayName, kind }
│   ├── isAuthenticated: boolean
│   ├── isLoading: boolean
│   └── isDemoMode: boolean
│
└── ChatPage State (Local)
    ├── entities: Entity[]
    ├── conversations: Conversation[]
    ├── messages: Message[]
    └── UI State
        ├── isLoading
        ├── isSidebarOpen
        ├── isTyping
        ├── isNewWorkstreamOpen
        └── inspectingEntity
```

### Entity Structure
```
Entity
├── id: string
├── name: string
├── avatar: string
├── type: 'human' | 'agent' | 'system'
├── status: 'online' | 'offline' | 'away' | 'busy'
├── role?: string
├── bio?: string
└── trustScore?: number
```

### Conversation Structure
```
Conversation
├── id: string
├── participants: string[]
├── isGroup: boolean
├── name?: string
├── avatar?: string
├── lastMessage?: string
├── lastMessageTime?: string
└── unreadCount: number
```

### Message Structure
```
Message
├── id: string
├── from: string
├── to: string
├── content: string
├── timestamp: Date
├── status: 'pending' | 'sent' | 'failed'
├── hash: string
├── type: 'chat' | 'command' | 'agreement' | 'system_alert'
└── parts?: MessagePart[]
    ├── text?: string
    ├── code?: string
    ├── jobCard?: JobCardData
    └── file?: FileData
```

### JobCard Structure
```
JobCardData
├── id: string
├── type: 'initiation' | 'progress' | 'completion' | 'approval'
├── title: string
├── description: string
├── status: 'pending' | 'running' | 'completed' | 'failed'
├── progress: number
├── duration?: string
└── metadata?: {
    ├── items?: { label: string; value: string }[]
    ├── amount?: string
    └── resultUrl?: string
}
```

---

## 🔌 Wiring Status

### ✅ Fully Wired
- Authentication flow (WebAuthn)
- Bootstrap data loading
- Send message
- Create conversation
- Job approval/rejection
- WebSocket job updates
- Navigation
- Modal dialogs

### 🟡 Partially Wired
- Job listing (via projection, not direct API)
- Settings (local only, not persisted)
- Status toggle (demo only, not persisted)
- Entity profile (view only, no edit)

### ❌ Not Wired
- File attachments
- Message editing/deletion
- Conversation deletion
- Real-time message delivery
- Presence updates
- Typing indicators
- Read receipts
- Settings persistence
- Profile editing
- Passkey management

---

## 🎯 Frontend Requirements Checklist

### Core Features (Must Have)
- [x] WebAuthn authentication
- [x] Session management
- [x] Conversation list
- [x] Message display
- [x] Send messages
- [x] Entity profiles
- [x] Job cards
- [x] Job approval/rejection
- [x] Real-time job updates
- [x] Responsive design
- [x] Error handling
- [x] Loading states

### Enhanced Features (Should Have)
- [ ] File attachments
- [ ] Real-time messages
- [ ] Presence updates
- [ ] Settings persistence
- [ ] Global search
- [ ] Read receipts
- [ ] Typing indicators

### Advanced Features (Nice to Have)
- [ ] Message reactions
- [ ] Threaded conversations
- [ ] Mentions
- [ ] Pinned messages
- [ ] Analytics dashboard
- [ ] Export data
- [ ] PWA support

---

## 🛠️ Technical Stack

**Core:**
- React 18.3+ (UI framework)
- TypeScript 5.6+ (type safety)
- React Router 6.28+ (routing)

**UI:**
- Tailwind CSS 3.4+ (styling)
- Framer Motion 11.15+ (animations)
- Lucide React (icons)
- React Hot Toast (notifications)

**Auth:**
- @simplewebauthn/browser 11.0+ (WebAuthn)

**Build:**
- Vite 6.0+ (bundler)
- ESLint + Prettier (code quality)

---

## 📝 Quick Start

### Development
```bash
cd apps/messenger/frontend
npm install
npm run dev
```

### Environment Variables
```bash
VITE_API_BASE_URL=http://localhost:8080
VITE_TENANT_ID=T.UBL
VITE_RUNNER_TARGET=LAB_512
```

### Build
```bash
npm run build
```

---

## 🎨 Design System

**Colors:**
- Accent: Orange (#E07A5F)
- Success: Green
- Warning: Yellow
- Error: Red
- Info: Blue

**Typography:**
- Font: System fonts
- Sizes: xs (10px), sm (12px), base (14px), lg (16px), xl (20px)
- Weights: Regular, Semibold, Bold, Black

**Spacing:**
- Base unit: 4px
- Common: 2, 3, 4, 5, 6, 8, 10, 12

**Components:**
- Cards: Rounded-xl, border, shadow
- Buttons: Rounded-lg, uppercase tracking-wider
- Inputs: Rounded-xl, border, focus ring
- Modals: Rounded-2xl, backdrop blur

---

## 📚 Key Files Reference

**Pages:**
- `src/pages/LoginPage.tsx` - Authentication
- `src/pages/ChatPage.tsx` - Main interface
- `src/pages/SettingsPage.tsx` - Settings

**Components:**
- `src/components/Sidebar.tsx` - Navigation
- `src/components/ChatView.tsx` - Message display
- `src/components/WelcomeScreen.tsx` - Landing
- `src/components/cards/JobCardRenderer.tsx` - Job cards
- `src/components/modals/NewWorkstreamModal.tsx` - Create conversation
- `src/components/modals/EntityProfileModal.tsx` - Entity profile

**Services:**
- `src/services/ublApi.ts` - Messenger API client
- `src/services/jobsApi.ts` - Jobs API + WebSocket
- `src/services/apiClient.ts` - HTTP client wrapper
- `src/services/ledger.ts` - Ledger utilities

**Context:**
- `src/context/AuthContext.tsx` - Authentication state

**Types:**
- `src/types.ts` - TypeScript definitions

---

**Last Updated**: December 2024  
**Version**: 1.0.0

