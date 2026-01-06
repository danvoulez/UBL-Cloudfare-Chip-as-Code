/**
 * UBL API Service
 * Communicates with UBL Kernel's Messenger Gateway (v1) and Messenger Boundary (messenger_v1)
 * 
 * Fix #2: Supports client-side Ed25519 signing when PRF is available
 */

import { api } from './apiClient';
import type { Conversation, Entity, Message, MessageType, UserSettings } from '../types';
import { 
  isClientSideSigningAvailable, 
  signLink, 
  hashAtom,
  type LinkToSign,
  type SignedLink,
} from './crypto';

// ============================================================================
// Types for API responses
// ============================================================================

type JsonMessage = Omit<Message, 'timestamp'> & { timestamp: string };

interface BootstrapApiResponse {
  user: {
    sid: string;
    display_name: string;
    kind: string;
  } | null;
  entities: Array<{
    id: string;
    display_name: string;
    kind: string;
    avatar_url: string | null;
    status: string | null;
  }>;
  conversations: Array<{
    id: string;
    name: string | null;
    is_group: boolean;
    participants: string[];
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
  }>;
  messages: Array<{
    id: string;
    conversation_id: string;
    from_id: string;
    content: string;
    content_hash: string;
    message_type: string;
    timestamp: string;
  }>;
}

interface SendMessageApiResponse {
  message_id: string;
  hash: string;
  sequence: number;
}

interface CreateConversationApiResponse {
  id: string;
  hash: string;
}

interface ApprovalDecisionApiResponse {
  job_id: string;
  decision: string;
  hash: string;
}

// ============================================================================
// Mappers
// ============================================================================

function mapEntity(e: BootstrapApiResponse['entities'][0]): Entity {
  return {
    id: e.id,
    name: e.display_name,
    avatar: e.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${e.id}`,
    type: e.kind === 'person' ? 'human' : e.kind === 'llm' ? 'agent' : 'system',
    status: (e.status as any) || 'online',
  };
}

function mapConversation(c: BootstrapApiResponse['conversations'][0]): Conversation {
  return {
    id: c.id,
    name: c.name || undefined,
    isGroup: c.is_group,
    participants: c.participants,
    lastMessage: c.last_message || undefined,
    lastMessageTime: c.last_message_at 
      ? formatTimeAgo(new Date(c.last_message_at)) 
      : undefined,
    unreadCount: c.unread_count,
  };
}

function mapMessage(m: BootstrapApiResponse['messages'][0]): Message {
  return {
    id: m.id,
    from: m.from_id,
    to: m.conversation_id,
    content: m.content,
    hash: m.content_hash,
    type: m.message_type as MessageType,
    timestamp: new Date(m.timestamp),
    status: 'sent',
  };
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ============================================================================
// API Client
// ============================================================================

export const ublApi = {
  /**
   * Health check - tests connectivity
   */
  async health(): Promise<{ ok: true }> {
    return api.get<{ ok: true }>(`/health`);
  },

  /**
   * Bootstrap - get initial state (user, entities, conversations, messages)
   * Endpoint: GET /messenger/bootstrap
   */
  async bootstrap(): Promise<{ 
    user: Entity | null;
    entities: Entity[]; 
    conversations: Conversation[]; 
    messages: Message[];
  }> {
    const res = await api.get<BootstrapApiResponse>(`/messenger/bootstrap`);
    
    return {
      user: res.user ? {
        id: res.user.sid,
        name: res.user.display_name,
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${res.user.sid}`,
        type: res.user.kind === 'person' ? 'human' : 'agent',
        status: 'online',
      } : null,
      entities: res.entities.map(mapEntity),
      conversations: res.conversations.map(mapConversation),
      messages: res.messages.map(mapMessage),
    };
  },

  /**
   * List entities
   * Endpoint: GET /messenger/entities
   */
  async listEntities(): Promise<Entity[]> {
    const res = await api.get<BootstrapApiResponse['entities']>(`/messenger/entities`);
    return res.map(mapEntity);
  },

  /**
   * List conversations
   * Endpoint: GET /messenger/conversations
   */
  async listConversations(): Promise<Conversation[]> {
    const res = await api.get<BootstrapApiResponse['conversations']>(`/messenger/conversations`);
    return res.map(mapConversation);
  },

  /**
   * Create conversation/workstream
   * Endpoint: POST /messenger/conversations
   */
  async createConversation(input: { 
    participants: string[]; 
    name?: string; 
    isGroup?: boolean;
  }): Promise<{ id: string; hash: string }> {
    const res = await api.post<CreateConversationApiResponse>(`/messenger/conversations`, {
      participants: input.participants,
      name: input.name,
      is_group: input.isGroup,
    });
    return { id: res.id, hash: res.hash };
  },

  /**
   * Send message
   * Endpoint: POST /messenger/messages
   */
  async sendMessage(input: { 
    conversationId: string; 
    content: string; 
    type?: MessageType;
  }): Promise<{ messageId: string; hash: string; sequence: number }> {
    const res = await api.post<SendMessageApiResponse>(`/messenger/messages`, {
      conversation_id: input.conversationId,
      content: input.content,
      message_type: input.type || 'text',
    });
    return { 
      messageId: res.message_id, 
      hash: res.hash, 
      sequence: res.sequence,
    };
  },

  /**
   * Approve a job
   * Endpoint: POST /messenger/jobs/:id/approve
   */
  async approveJob(jobId: string, reason?: string): Promise<ApprovalDecisionApiResponse> {
    return api.post<ApprovalDecisionApiResponse>(`/messenger/jobs/${jobId}/approve`, { reason });
  },

  /**
   * Reject a job
   * Endpoint: POST /messenger/jobs/:id/reject
   */
  async rejectJob(jobId: string, reason?: string): Promise<ApprovalDecisionApiResponse> {
    return api.post<ApprovalDecisionApiResponse>(`/messenger/jobs/${jobId}/reject`, { reason });
  },

  /**
   * Get user info (from identity API)
   * Endpoint: GET /id/whoami
   */
  async getMe(): Promise<{ sid: string; displayName: string; kind: string; authenticated: boolean }> {
    const res = await api.get<{
      sid: string | null;
      kind: string | null;
      display_name: string | null;
      authenticated: boolean;
    }>(`/id/whoami`);
    
    return {
      sid: res.sid || '',
      displayName: res.display_name || '',
      kind: res.kind || '',
      authenticated: res.authenticated,
    };
  },

  /**
   * Get user settings (placeholder - to be implemented)
   */
  async getSettings(): Promise<UserSettings> {
    // TODO: Implement when settings endpoint exists
    return {
      theme: 'dark',
      fontSize: 'md',
      audioEnabled: true,
      notificationsEnabled: true,
    };
  },

  /**
   * Update user settings (placeholder - to be implemented)
   */
  async updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
    // TODO: Implement when settings endpoint exists
    console.log('Settings update:', patch);
    return this.getSettings();
  },

  // ============================================================================
  // Gateway API (v1)
  // ============================================================================

  /**
   * Send message via Gateway with optional client-side signing (Fix #2)
   * Endpoint: POST /v1/conversations/:id/messages
   * 
   * If client-side signing is available (PRF derived key), the message will be
   * signed locally before sending. Otherwise, the server will sign using the
   * boundary key.
   */
  async sendMessageViaGateway(input: {
    conversationId: string;
    content: string;
    messageType?: MessageType;
    idempotencyKey?: string;
  }): Promise<{ messageId: string; hash: string; sequence: number; action: string; signedClientSide: boolean }> {
    // Check if we can sign client-side
    const canSign = isClientSideSigningAvailable();
    
    // Build request body
    const body: any = {
      content: input.content,
      message_type: input.messageType || 'text',
      idempotency_key: input.idempotencyKey,
    };
    
    // If client-side signing is available, we'd prepare a pre-signed link
    // Note: This requires backend support for accepting pre-signed links
    // For now, we just indicate to the server that we have signing capability
    if (canSign) {
      body.client_signing_capable = true;
      // In a full implementation, we would:
      // 1. Get container state from server
      // 2. Build link draft
      // 3. Sign it
      // 4. Send the full signed link
      // For now, this flag tells the server the client CAN sign
    }
    
    const res = await api.post<{
      message_id: string;
      hash: string;
      sequence: number;
      action: string;
    }>(`/v1/conversations/${input.conversationId}/messages`, body);
    
    return {
      messageId: res.message_id,
      hash: res.hash,
      sequence: res.sequence,
      action: res.action,
      signedClientSide: false, // For now, always server-signed
    };
  },

  /**
   * Send a pre-signed message (Fix #2: Full client-side signing)
   * Endpoint: POST /link/commit (direct to UBL kernel)
   * 
   * This bypasses the gateway and sends a fully formed, signed link
   * directly to the UBL kernel membrane.
   */
  async sendSignedMessage(input: {
    conversationId: string;
    content: string;
    expectedSequence: number;
    previousHash: string;
  }): Promise<{ hash: string; sequence: number } | null> {
    if (!isClientSideSigningAvailable()) {
      console.warn('Client-side signing not available');
      return null;
    }
    
    // Build atom
    const messageId = crypto.randomUUID();
    const atom = {
      '@type': 'ubl.atom.Message',
      '@timestamp': new Date().toISOString(),
      container_id: input.conversationId,
      message_id: messageId,
      content: input.content,
      message_type: 'text',
    };
    
    // Hash atom
    const atomHash = await hashAtom(atom);
    
    // Build link to sign
    const linkToSign: LinkToSign = {
      version: 1,
      container_id: input.conversationId,
      expected_sequence: input.expectedSequence,
      previous_hash: input.previousHash,
      atom_hash: atomHash,
      intent_class: 'Observation',
      physics_delta: '0',
      pact: null,
      atom: atom,
    };
    
    // Sign the link
    const signedLink = await signLink(linkToSign);
    if (!signedLink) {
      console.error('Failed to sign link');
      return null;
    }
    
    // Submit to kernel
    const res = await api.post<{
      hash: string;
      sequence: number;
    }>(`/link/commit`, signedLink);
    
    return res;
  },

  /**
   * Handle job action via Gateway
   * Endpoint: POST /v1/jobs/:id/actions
   */
  async jobActionViaGateway(input: {
    jobId: string;
    actionType: string;
    buttonId: string;
    cardId: string;
    inputData?: any;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; eventIds: string[] }> {
    const res = await api.post<{
      success: boolean;
      event_ids: string[];
    }>(`/v1/jobs/${input.jobId}/actions`, {
      action_type: input.actionType,
      button_id: input.buttonId,
      card_id: input.cardId,
      input_data: input.inputData,
      idempotency_key: input.idempotencyKey,
    });
    return {
      success: res.success,
      eventIds: res.event_ids,
    };
  },

  /**
   * Get conversation timeline
   * Endpoint: GET /v1/conversations/:id/timeline
   */
  async getTimeline(input: {
    conversationId: string;
    tenantId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: any[]; cursor: string }> {
    const params = new URLSearchParams();
    if (input.tenantId) params.set('tenant_id', input.tenantId);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.limit) params.set('limit', input.limit.toString());

    const res = await api.get<{
      items: any[];
      cursor: string;
    }>(`/v1/conversations/${input.conversationId}/timeline?${params.toString()}`);
    return res;
  },

  /**
   * Get job details for drawer
   * Endpoint: GET /v1/jobs/:id
   */
  async getJob(input: {
    jobId: string;
    tenantId?: string;
  }): Promise<{
    jobId: string;
    title: string;
    goal: string;
    state: string;
    owner: any;
    availableActions: any[];
    timeline: any[];
    artifacts: any[];
  }> {
    const params = new URLSearchParams();
    if (input.tenantId) params.set('tenant_id', input.tenantId);

    const res = await api.get<{
      job_id: string;
      title: string;
      goal: string;
      state: string;
      owner: any;
      available_actions: any[];
      timeline: any[];
      artifacts: any[];
    }>(`/v1/jobs/${input.jobId}?${params.toString()}`);
    
    return {
      jobId: res.job_id,
      title: res.title,
      goal: res.goal,
      state: res.state,
      owner: res.owner,
      availableActions: res.available_actions,
      timeline: res.timeline,
      artifacts: res.artifacts,
    };
  },

  // ============================================================================
  // Onboarding/Tenant API (stubs)
  // ============================================================================

  /**
   * Provision a new tenant
   */
  async provisionTenant(name: string, domain: string): Promise<{
    id: string;
    name: string;
    domain: string;
    tier: 'free' | 'enterprise' | 'sovereign';
    createdAt: Date;
    inviteCode: string;
  }> {
    // TODO: Implement when tenant provisioning endpoint exists
    console.log('Provision tenant:', name, domain);
    return {
      id: `tenant_${Date.now()}`,
      name,
      domain,
      tier: 'free',
      createdAt: new Date(),
      inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
    };
  },

  /**
   * Join an existing tenant via invite code
   */
  async joinTenant(inviteCode: string): Promise<{
    id: string;
    name: string;
    domain: string;
    tier: 'free' | 'enterprise' | 'sovereign';
    createdAt: Date;
    inviteCode: string;
  }> {
    // TODO: Implement when tenant join endpoint exists
    console.log('Join tenant with code:', inviteCode);
    return {
      id: `tenant_${Date.now()}`,
      name: 'Joined Tenant',
      domain: 'joined.example.com',
      tier: 'free',
      createdAt: new Date(),
      inviteCode,
    };
  },

  /**
   * Create a session for a tenant
   */
  async createSession(input: { tenantId: string; user: any }): Promise<{
    user: Entity;
    tenant: any;
    token: string;
  }> {
    // TODO: Implement when session endpoint exists
    console.log('Create session:', input);
    return {
      user: {
        id: input.user.id || `user_${Date.now()}`,
        name: input.user.name || 'New User',
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${Date.now()}`,
        type: 'human',
        status: 'online',
      },
      tenant: { id: input.tenantId },
      token: `token_${Date.now()}`,
    };
  },

  /**
   * Update current user
   */
  async updateMe(patch: Partial<Entity>): Promise<Entity> {
    // TODO: Implement when update endpoint exists
    console.log('Update me:', patch);
    return {
      id: 'current_user',
      name: patch.name || 'User',
      avatar: patch.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=user`,
      type: 'human',
      status: 'online',
      ...patch,
    } as Entity;
  },

  /**
   * Create an entity
   */
  async createEntity(entity: Partial<Entity>): Promise<Entity> {
    // TODO: Implement when entity creation endpoint exists
    console.log('Create entity:', entity);
    return {
      id: `entity_${Date.now()}`,
      name: entity.name || 'New Entity',
      avatar: entity.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${Date.now()}`,
      type: entity.type || 'human',
      status: 'online',
      ...entity,
    } as Entity;
  },

  /**
   * Pin an asset to a conversation
   */
  async pinAsset(input: { conversationId: string; asset: any }): Promise<Conversation> {
    // TODO: Implement when pin endpoint exists
    console.log('Pin asset:', input);
    return {
      id: input.conversationId,
      participants: [],
      isGroup: false,
    };
  },

  /**
   * Unpin an asset from a conversation
   */
  async unpinAsset(input: { conversationId: string; assetId: string }): Promise<Conversation> {
    // TODO: Implement when unpin endpoint exists
    console.log('Unpin asset:', input);
    return {
      id: input.conversationId,
      participants: [],
      isGroup: false,
    };
  },
};
