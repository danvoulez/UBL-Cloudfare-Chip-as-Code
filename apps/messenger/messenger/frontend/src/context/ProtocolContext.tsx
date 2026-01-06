
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Entity, Message, Conversation, MessageType, PinnedAsset } from '../types';
import { LedgerService } from '../services/ledger';
import { ublApi } from '../services/ublApi';
import { sanitizeInput } from '../utils/security';
import { eventBus, PROTOCOL_EVENTS } from '../services/eventBus';
import { useNotifications } from './NotificationContext';
import { useOnboarding } from './OnboardingContext';

interface ProtocolContextType {
  entities: Entity[];
  conversations: Conversation[];
  messages: Message[];
  activeConvId: string | null;
  setActiveConvId: (id: string | null) => void;
  dispatchMessage: (content: string, type?: MessageType) => Promise<void>;
  addEntity: (entity: Entity) => Promise<void>;
  updateEntity: (entity: Entity) => Promise<void>;
  createConversation: (participants: string[], name?: string, isGroup?: boolean) => string;
  pinAsset: (convId: string, asset: Omit<PinnedAsset, 'id'>) => Promise<void>;
  unpinAsset: (convId: string, assetId: string) => Promise<void>;
  isSyncing: boolean;
  tenantUsers: Entity[];
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

export const ProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useOnboarding();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { notify } = useNotifications();

  const tenantUsers = entities.filter(e => e.type === 'human' && e.id !== session?.user.id);

  // Initial sync from backend
  useEffect(() => {
    if (!session?.token) return;
    setIsSyncing(true);
    ublApi
      .bootstrap()
      .then((data) => {
        setEntities(data.entities);
        setConversations(data.conversations);
        setMessages(data.messages);

        // Select first conversation by default
        if (!activeConvId && data.conversations.length > 0) {
          setActiveConvId(data.conversations[0].id);
        }
      })
      .catch((e: any) => {
        console.error('[ProtocolContext] bootstrap failed', e);
        notify({ type: 'error', title: 'Sync Failed', message: e.message || 'Could not load protocol state.' });
      })
      .finally(() => setIsSyncing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const addEntity = useCallback(async (entity: Entity) => {
    try {
      const created = await ublApi.createEntity(entity);
      setEntities(prev => [...prev, created]);
    } catch (e: any) {
      notify({ type: 'error', title: 'Entity Create Failed', message: e.message || 'Unable to create entity.' });
    }
  }, [notify]);

  const updateEntity = useCallback(async (entity: Entity) => {
    try {
      const updated = await ublApi.createEntity(entity);
      setEntities(prev => prev.map(e => (e.id === updated.id ? updated : e)));
    } catch (e: any) {
      notify({ type: 'error', title: 'Update Failed', message: e.message || 'Unable to update entity.' });
    }
  }, [notify]);

  const pinAsset = useCallback(async (convId: string, asset: Omit<PinnedAsset, 'id'>) => {
    try {
      const updated = await ublApi.pinAsset({ conversationId: convId, asset });
      setConversations(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      notify({ type: 'success', title: 'Asset Pinned', message: `${asset.title} is now pinned to this context.` });
    } catch (e: any) {
      notify({ type: 'error', title: 'Pin Failed', message: e.message || 'Unable to pin asset.' });
    }
  }, [notify]);

  const unpinAsset = useCallback(async (convId: string, assetId: string) => {
    try {
      const updated = await ublApi.unpinAsset({ conversationId: convId, assetId });
      setConversations(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      notify({ type: 'error', title: 'Unpin Failed', message: e.message || 'Unable to unpin asset.' });
    }
  }, [notify]);

  const createConversation = useCallback((participants: string[], name?: string, isGroup: boolean = false): string => {
    if (!session?.user) return '';
    // Fire-and-forget async, but return a temp id for immediate UI selection
    const tempId = `conv-${Date.now()}`;
    const allParticipants = Array.from(new Set([...participants, session.user.id]));
    const optimistic: Conversation = {
      id: tempId,
      participants: allParticipants,
      isGroup,
      name,
      unreadCount: 0,
      lastMessage: isGroup ? 'Protocol Group Initialized.' : 'Direct Handshake Established.'
    };
    setConversations(prev => [optimistic, ...prev]);
    setActiveConvId(tempId);

    ublApi
      .createConversation({ participants: allParticipants, name, isGroup })
      .then((created) => {
        // API returns { id, hash }, merge with optimistic conversation data
        const fullConversation: Conversation = {
          ...optimistic,
          id: created.id,
        };
        setConversations(prev => prev.map(c => (c.id === tempId ? fullConversation : c)));
        setActiveConvId(created.id);
      })
      .catch((e: any) => {
        console.error('[ProtocolContext] createConversation failed', e);
        notify({ type: 'error', title: 'Conversation Create Failed', message: e.message || 'Unable to create conversation.' });
        setConversations(prev => prev.filter(c => c.id !== tempId));
        setActiveConvId(null);
      });

    return tempId;
  }, [notify, session]);

  const dispatchMessage = useCallback(async (content: string, type: MessageType = 'chat') => {
    if (!activeConvId || !session?.user) return;
    const sanitized = sanitizeInput(content);
    if (!sanitized) return;

    const activeConv = conversations.find(c => c.id === activeConvId);
    if (!activeConv) return;

    // Optimistic message while the backend signs/broadcasts.
    const optimisticHash = LedgerService.generateHashSync(sanitized);
    const optimisticCost = LedgerService.calculateExecutionCost(sanitized, false);
    const optimisticId = `tx-local-${Date.now()}`;
    const toId = activeConv.isGroup
      ? activeConv.id
      : activeConv.participants.find(p => p !== session.user.id) || activeConv.id;

    const optimistic: Message = {
      id: optimisticId,
      from: session.user.id,
      to: toId,
      content: sanitized,
      timestamp: new Date(),
      status: 'pending',
      hash: optimisticHash,
      type,
      cost: optimisticCost
    };

    setMessages(prev => [...prev, optimistic]);
    setIsSyncing(true);

    try {
      const res = await ublApi.sendMessage({ conversationId: activeConvId, content: sanitized, type });
      // Update optimistic message with backend response
      setMessages(prev => {
        const without = prev.filter(m => m.id !== optimisticId);
        const confirmed: Message = {
          ...optimistic,
          id: res.messageId,
          hash: res.hash,
          status: 'sent',
        };
        return [...without, confirmed];
      });

      // Best-effort local lastMessage update
      setConversations(prev => prev.map(c => (c.id === activeConvId ? { ...c, lastMessage: sanitized } : c)));

      eventBus.emit(PROTOCOL_EVENTS.MESSAGE_SENT, { messageId: res.messageId, hash: res.hash });
    } catch (e: any) {
      console.error('[ProtocolContext] sendMessage failed', e);
      // Diamond Checklist #9: Remove failed message from UI (rollback optimistic update)
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      notify({ type: 'error', title: 'Send Failed', message: e.message || 'Message could not be broadcast.' });
    } finally {
      setIsSyncing(false);
    }
  }, [activeConvId, conversations, notify, session?.user]);

  return (
    <ProtocolContext.Provider value={{
      entities, conversations, messages, activeConvId, 
      setActiveConvId, dispatchMessage, addEntity, createConversation, 
      updateEntity,
      pinAsset, unpinAsset, isSyncing, tenantUsers
    }}>
      {children}
    </ProtocolContext.Provider>
  );
};

export const useProtocol = () => {
  const context = useContext(ProtocolContext);
  if (!context) throw new Error('useProtocol must be used within ProtocolProvider');
  return context;
};
