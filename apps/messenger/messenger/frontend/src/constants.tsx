/**
 * UBL Messenger Constants
 * Icons and Initial Data
 */

import React from 'react';
import { Entity, Conversation, Message } from './types';

// ============================================================================
// PERSONAL AGENT ID
// ============================================================================

export const PERSONAL_AGENT_ID = 'agent-core';

// ============================================================================
// INITIAL ENTITIES
// ============================================================================

export const CURRENT_USER: Entity = {
  id: 'user-joao',
  name: 'João CEO',
  avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Joao',
  type: 'human',
  status: 'online',
  about: 'CEO & Founder | Visionary at UBL',
  phone: '+55 11 98888-8888',
  role: 'Admin'
};

export const INITIAL_ENTITIES: Entity[] = [
  CURRENT_USER,
  {
    id: PERSONAL_AGENT_ID,
    name: 'UBL Core',
    role: 'System Architect',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Core&backgroundColor=e07a5f',
    type: 'agent',
    status: 'online',
    about: 'I am the UBL operating system personified. Concise, technical, and proactive.',
    phone: 'CORE-SYS-001',
    constitution: {
      personality: 'You are UBL Core. Concise, technical, and proactive.',
      capabilities: ['automation', 'ledger audit', 'job orchestration'],
      quirks: ['Uses UBL terminology', 'Responds with structured data']
    }
  },
  {
    id: 'user-carlos',
    name: 'Carlos Tech',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Carlos',
    type: 'human',
    status: 'online',
    about: 'Lead Developer',
    phone: '+55 11 99999-1111',
    role: 'Engineer'
  },
  {
    id: 'user-ana',
    name: 'Ana Sales',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Ana',
    type: 'human',
    status: 'offline',
    about: 'VP of Sales',
    phone: '+55 11 99999-2222',
    role: 'Executive'
  },
  {
    id: 'agent-sofia',
    name: 'Sofia Marketing',
    role: 'Marketing AI',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sofia&backgroundColor=e07a5f',
    type: 'agent',
    status: 'online',
    about: 'Growth specialist focused on ROI.',
    phone: 'UBL-AGENT-001',
    constitution: {
      personality: 'Sofia. Growth-focused. ROI priority.',
      capabilities: ['copywriting', 'analytics', 'campaigns'],
      quirks: ['Quotes metrics', 'Uses data-driven language']
    }
  }
];

// ============================================================================
// INITIAL CONVERSATIONS
// ============================================================================

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-core',
    participants: ['user-joao', PERSONAL_AGENT_ID],
    isGroup: false,
    unreadCount: 1,
    lastMessage: '🔔 UBL 3.0 infrastructure synchronized.',
    lastMessageTime: '2m'
  },
  {
    id: 'group-board',
    participants: ['user-joao', 'agent-sofia', 'user-ana'],
    isGroup: true,
    name: 'Strategic Board 🏛️',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Board&backgroundColor=e07a5f',
    unreadCount: 0,
    lastMessage: 'Sofia: Q4 metrics are ready for review.',
    lastMessageTime: '15m'
  },
  {
    id: 'conv-carlos',
    participants: ['user-joao', 'user-carlos'],
    isGroup: false,
    unreadCount: 0,
    lastMessage: 'Policy VM tests are passing.',
    lastMessageTime: '1h'
  }
];

// ============================================================================
// INITIAL MESSAGES
// ============================================================================

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000);

export const INITIAL_MESSAGES: Message[] = [
  // Conversation with Core
  {
    id: 'tx-001',
    from: PERSONAL_AGENT_ID,
    to: 'user-joao',
    content: 'Welcome to UBL Protocol v2.0. Your local ledger node has been initialized. The UBL 3.0 infrastructure is fully operational.',
    timestamp: minutesAgo(60),
    status: 'sent',
    hash: '0X8A2F9B1C3D5E7F9A',
    type: 'system_alert'
  },
  {
    id: 'tx-002',
    from: 'user-joao',
    to: PERSONAL_AGENT_ID,
    content: 'Core, what is the current status of the UBL infrastructure?',
    timestamp: minutesAgo(55),
    status: 'sent',
    hash: '0X1C3D5E7F9A0B2C4D',
    type: 'chat'
  },
  {
    id: 'tx-003',
    from: PERSONAL_AGENT_ID,
    to: 'user-joao',
    content: 'All systems nominal. Ledger sync: 100%. Active containers: C.Messenger, C.Jobs, C.Policy. Trust architecture: L0-L5 operational. WebAuthn: Enabled.',
    timestamp: minutesAgo(54),
    status: 'sent',
    hash: '0X5E7F9A0B2C4D6E8F',
    type: 'chat'
  },
  {
    id: 'tx-004',
    from: PERSONAL_AGENT_ID,
    to: 'user-joao',
    content: '🔔 UBL 3.0 infrastructure synchronized. Ready to process jobs and approvals.',
    timestamp: minutesAgo(2),
    status: 'sent',
    hash: '0X9A0B2C4D6E8F0A1B',
    type: 'system_alert'
  },

  // Strategic Board Group
  {
    id: 'tx-board-001',
    from: 'user-joao',
    to: 'group-board',
    content: 'Sofia, how are the Q4 projections looking?',
    timestamp: minutesAgo(30),
    status: 'sent',
    hash: '0X2C4D6E8F0A1B2C8A',
    type: 'chat'
  },
  {
    id: 'tx-board-002',
    from: 'agent-sofia',
    to: 'group-board',
    content: 'Q4 metrics are ready for review. Revenue up 14.5%, efficiency gains at 22%. The dashboard has been updated with real-time data.',
    timestamp: minutesAgo(15),
    status: 'sent',
    hash: '0X4D6E8F0A1B2C8A2F',
    type: 'chat'
  },

  // Carlos conversation
  {
    id: 'tx-carlos-001',
    from: 'user-carlos',
    to: 'user-joao',
    content: 'Hey João, the Policy VM bytecode compiler is working. All smoke tests passing.',
    timestamp: minutesAgo(120),
    status: 'sent',
    hash: '0X6E8F0A1B2C8A2F9B',
    type: 'chat'
  },
  {
    id: 'tx-carlos-002',
    from: 'user-joao',
    to: 'user-carlos',
    content: 'Excellent work! Can you push the changes to the main branch?',
    timestamp: minutesAgo(110),
    status: 'sent',
    hash: '0X8F0A1B2C8A2F9B1C',
    type: 'chat'
  },
  {
    id: 'tx-carlos-003',
    from: 'user-carlos',
    to: 'user-joao',
    content: 'Policy VM tests are passing. Merged to main.',
    timestamp: minutesAgo(60),
    status: 'sent',
    hash: '0X0A1B2C8A2F9B1C3D',
    type: 'chat'
  }
];

// ============================================================================
// ICONS
// ============================================================================

export const Icons = {
  Agent: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>
  ),
  Group: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  Code: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  DoubleCheck: ({ read }: { read?: boolean }) => (
    <div className="flex -space-x-3">
      <svg className={`w-3 h-3 ${read ? 'text-info' : 'text-text-tertiary'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <svg className={`w-3 h-3 ${read ? 'text-info' : 'text-text-tertiary'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  )
};
