/**
 * UBL Messenger Types
 * Core type definitions for the UBL Messenger frontend
 */

// ============================================================================
// Base IDs
// ============================================================================

export type EntityId = string;
export type GroupId = string;
export type TenantId = string;
export type Role = 'user' | 'assistant' | 'system';

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 'human' | 'agent' | 'system' | 'individual' | 'group' | 'kernel';
export type MessageStatus = 'pending' | 'signed' | 'broadcasted' | 'failed' | 'sent' | 'delivered' | 'read';
export type MessageType = 'chat' | 'command' | 'agreement' | 'system_alert';

// ============================================================================
// Tenant & Session
// ============================================================================

export interface Tenant {
  id: TenantId;
  name: string;
  domain: string;
  tier: 'free' | 'enterprise' | 'sovereign';
  createdAt: Date;
  status?: string;
  namespaceHash?: string;
  inviteCode?: string;
}

export interface UserSession {
  user: Entity;
  tenant: Tenant;
  token: string;
}

export interface UserAccount {
  name: string;
  role: string;
  avatar: string;
  entityId: string;
  bio: string;
  joinedAt: string;
  trustScore: number;
  tenantId: string;
  stats: {
    ledgerEntries: number;
    activeJobs: number;
    uptime: string;
  };
}

export interface UserSettings {
  theme: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg';
  audioEnabled: boolean;
  notificationsEnabled: boolean;
  glowIntensity?: number;
}

// ============================================================================
// Entity
// ============================================================================

export interface Entity {
  id: EntityId;
  name: string;
  avatar: string;
  type: EntityType;
  status?: 'online' | 'offline' | 'working' | 'typing' | 'away' | 'busy';
  about?: string;
  phone?: string;
  role?: string;
  bio?: string;
  trustScore?: number;
  capabilities?: string[];
  joinedAt?: string;
  location?: string;
  entityId?: string;
  activeHours?: string;
  completedJobs?: number;
  constitution?: {
    personality: string;
    capabilities: string[];
    quirks: string[];
  };
}

// Alias for compatibility with orange frontend
export interface Contact extends Entity {
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  online?: boolean;
}

// ============================================================================
// Rich Content
// ============================================================================

export interface FileData {
  name: string;
  size: number;
  type: string;
  url: string;
  s3Key?: string;
  hash?: string;
  duration?: number;
}

export interface FileNode {
  name: string;
  type: 'file' | 'dir';
  size?: string;
  content?: string;
  language?: string;
  children?: FileNode[];
}

export interface PinnedAsset {
  id: string;
  type: 'file' | 'link' | 'code';
  title: string;
  url?: string;
  content?: string;
  language?: string;
  refId?: string;
}

export interface RichPayload {
  type: 'code' | 'alert' | 'filesystem' | 'terminal' | 'web' | 'job';
  title?: string;
  description?: string;
  url?: string;
  meta?: any;
  files?: FileNode[];
  output?: string;
}

export interface MessageAction {
  id: string;
  label: string;
  icon?: string;
  command: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
}

// ============================================================================
// Messages
// ============================================================================

export interface MessagePart {
  text?: string;
  code?: string;
  jobCard?: JobCardData;
  file?: FileData;
  audioUrl?: string;
}

export interface Message {
  id: string;
  from?: EntityId;
  to?: EntityId | GroupId;
  role?: Role;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  hash: string;
  type?: MessageType;
  cost?: number;
  payloads?: RichPayload[];
  actions?: MessageAction[];
  signatories?: EntityId[];
  error?: string;
  parts?: MessagePart[];
  isAgent?: boolean;
  ledger_index?: number;
  previous_hash?: string;
  tenant_id?: string;
  workstream_id?: string;
}

// ============================================================================
// Conversations
// ============================================================================

export interface Conversation {
  id: string;
  participants: EntityId[];
  isGroup: boolean;
  name?: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  pinnedAssets?: PinnedAsset[];
  online?: boolean;
  entityId?: string;
  type?: EntityType;
}

// ============================================================================
// Jobs
// ============================================================================

export type JobStatus = 
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';
export type JobCardType = 'initiation' | 'progress' | 'completion' | 'approval' | 'formalization' | 'result';

export interface JobStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
}

export interface JobArtifact {
  id: string;
  filename: string;
  type: 'pdf' | 'xlsx' | 'image' | 'document' | 'other';
  url: string;
  size?: string;
}

export interface JobCardData {
  id: string;
  type: JobCardType;
  title: string;
  description: string;
  status: JobStatus | 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  duration?: string;
  metadata?: {
    items?: { label: string; value: string }[];
    amount?: string;
    resultUrl?: string;
  };
}

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  priority: JobPriority;
  
  requestedBy: EntityId;
  assignedTo: EntityId;
  
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: string;
  actualDuration?: string;
  
  progress: number;
  steps?: JobStep[];
  currentStep?: string;
  
  result?: {
    summary: string;
    artifacts: JobArtifact[];
  };
  
  conversationId: string;
  ublEventHash?: string;
}

export interface ApprovalRequest {
  id: string;
  jobId: string;
  action: string;
  reason: string;
  details?: string[];
  requestedBy: EntityId;
  requestedAt: Date;
  
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: EntityId;
  decidedAt?: Date;
  decisionReason?: string;
}

export interface JobCardPayload extends RichPayload {
  type: 'job';
  cardType: JobCardType;
  job: Job;
  approvalRequest?: ApprovalRequest;
}
