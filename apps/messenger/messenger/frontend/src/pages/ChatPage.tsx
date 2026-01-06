/**
 * Chat Page - Main Messenger Interface
 * Sidebar + Chat View layout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatView from '../components/ChatView';
import WelcomeScreen from '../components/WelcomeScreen';
import { NewWorkstreamModal, EntityProfileModal } from '../components/modals';
import { JobDrawer } from '../components/JobDrawer';
import { Entity, Conversation, Message } from '../types';
import { INITIAL_ENTITIES, INITIAL_CONVERSATIONS, INITIAL_MESSAGES } from '../constants';
import { ublApi } from '../services/ublApi';
import { jobsApi } from '../services/jobsApi';
import { useSSE } from '../hooks/useSSE';
import toast from 'react-hot-toast';

export const ChatPage: React.FC = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, isDemoMode, logout } = useAuthContext();

  // Data state
  const [entities, setEntities] = useState<Entity[]>(INITIAL_ENTITIES);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  
  // UI state
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isNewWorkstreamOpen, setIsNewWorkstreamOpen] = useState(false);
  const [inspectingEntity, setInspectingEntity] = useState<Entity | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  // Current user entity
  const currentUser: Entity = {
    id: user?.sid || 'demo:user',
    name: user?.displayName || 'Demo User',
    avatar: user?.avatar || '',
    type: 'human',
    status: 'online',
  };

  // Load data
  useEffect(() => {
    if (isDemoMode) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const health = await ublApi.health();
        if (health.ok) {
          const bootstrap = await ublApi.bootstrap();
          setEntities(bootstrap.entities);
          setConversations(bootstrap.conversations);
          setMessages(bootstrap.messages);
        }
      } catch (err) {
        console.log('Using demo data - API not available');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isDemoMode]);

  // Subscribe to SSE updates
  useSSE('default', {
    'timeline.append': (event) => {
      const { conversation_id, item } = event.data;
      if (conversation_id === conversationId) {
        // Add new message/card to timeline
        if (item.item_type === 'message') {
          setMessages(prev => [...prev, item.item_data as Message]);
        }
      }
    },
    'job.update': (event) => {
      const { job_id, update } = event.data;
      console.log('[SSE] Job update:', job_id, update);
      // Update job state in UI
    },
    'presence.update': (event) => {
      const { entity_id, state } = event.data;
      setEntities(prev => prev.map(e => 
        e.id === entity_id ? { ...e, status: state as any } : e
      ));
    },
    'conversation.update': (event) => {
      const { conversation_id, update } = event.data;
      setConversations(prev => prev.map(c =>
        c.id === conversation_id ? { ...c, ...update } : c
      ));
    },
  });

  // Subscribe to job updates (WebSocket)
  useEffect(() => {
    if (isDemoMode) return;

    const unsubscribe = jobsApi.subscribe((event) => {
      console.log('[Jobs] Event:', event);
      // Handle job updates
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === conversationId);

  // Filter messages for current conversation
  const currentMessages = messages.filter(m => {
    if (!activeConversation) return false;
    if (activeConversation.isGroup) return m.to === activeConversation.id;
    const otherParticipant = activeConversation.participants.find(p => p !== currentUser.id);
    return (m.from === currentUser.id && m.to === otherParticipant) ||
           (m.from === otherParticipant && m.to === currentUser.id);
  });

  // Select conversation
  const handleSelectConversation = useCallback((id: string) => {
    navigate(`/chat/${id}`);
    setIsSidebarOpen(false);
  }, [navigate]);

  // Send message
  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeConversation || !content.trim()) return;

    const otherParticipant = activeConversation.isGroup
      ? activeConversation.id
      : activeConversation.participants.find(p => p !== currentUser.id);

    // Optimistic UI update
    const tempId = `msg_${Date.now()}`;
    const newMessage: Message = {
      id: tempId,
      from: currentUser.id,
      to: otherParticipant,
      content,
      timestamp: new Date(),
      status: 'pending',
      hash: '0x...',
      type: 'chat',
    };

    setMessages(prev => [...prev, newMessage]);
    setConversations(prev => prev.map(c =>
      c.id === activeConversation.id
        ? { ...c, lastMessage: content, lastMessageTime: 'now' }
        : c
    ));

    // If not demo mode, call real API
    if (!isDemoMode) {
      try {
        const result = await ublApi.sendMessage({
          conversationId: activeConversation.id,
          content,
          type: 'chat',
        });
        
        // Update message with real ID and hash
        setMessages(prev => prev.map(m => 
          m.id === tempId 
            ? { ...m, id: result.messageId, hash: result.hash, status: 'sent' } 
            : m
        ));
      } catch (err: any) {
        toast.error('Failed to send message');
        // Mark as failed
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'failed' } : m
        ));
        return;
      }
    } else {
      // Demo mode: update status to sent
      setMessages(prev => prev.map(m => 
        m.id === tempId 
          ? { ...m, hash: `0x${Math.random().toString(16).slice(2, 18).toUpperCase()}`, status: 'sent' } 
          : m
      ));
    }

    // Simulate AI response (demo mode or when talking to agent)
    const otherEntity = entities.find(e => e.id === otherParticipant);
    if (otherEntity?.type === 'agent' && isDemoMode) {
      setIsTyping(true);
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

      const aiMessage: Message = {
        id: `msg_${Date.now()}`,
        from: otherParticipant,
        to: currentUser.id,
        content: `Acknowledged. Processing "${content.slice(0, 50)}..."`,
        timestamp: new Date(),
        status: 'sent',
        hash: `0x${Math.random().toString(16).slice(2, 18).toUpperCase()}`,
        type: 'chat',
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }
  }, [activeConversation, currentUser, entities, isDemoMode]);

  // Open new workstream modal
  const handleNewConversation = useCallback(() => {
    setIsNewWorkstreamOpen(true);
  }, []);

  // Create new conversation (from modal)
  const handleCreateWorkstream = useCallback(async (data: { name: string; participants: string[]; isGroup: boolean }) => {
    // Demo mode: local only
    if (isDemoMode) {
      const newConv: Conversation = {
        id: `conv_${Date.now()}`,
        participants: data.participants,
        isGroup: data.isGroup,
        name: data.name || undefined,
        unreadCount: 0,
        lastMessage: 'Workstream created',
      };
      setConversations(prev => [newConv, ...prev]);
      navigate(`/chat/${newConv.id}`);
      toast.success(data.name ? `Created "${data.name}"` : 'Conversation started');
      return;
    }

    // Real API call
    try {
      const result = await ublApi.createConversation({
        name: data.name,
        participants: data.participants,
        isGroup: data.isGroup,
      });

      const newConv: Conversation = {
        id: result.id,
        participants: data.participants,
        isGroup: data.isGroup,
        name: data.name || undefined,
        unreadCount: 0,
        lastMessage: 'Workstream created',
      };

      setConversations(prev => [newConv, ...prev]);
      navigate(`/chat/${newConv.id}`);
      toast.success(data.name ? `Created "${data.name}"` : 'Conversation started');
    } catch (err: any) {
      toast.error('Failed to create workstream');
    }
  }, [navigate, isDemoMode]);

  // Inspect entity profile
  const handleInspectEntity = useCallback((entity: Entity) => {
    setInspectingEntity(entity);
  }, []);

  // Start chat from entity profile
  const handleStartChatFromProfile = useCallback((entityId: string) => {
    // Check if conversation already exists
    const existing = conversations.find(c => 
      !c.isGroup && c.participants.includes(entityId) && c.participants.includes(currentUser.id)
    );
    
    if (existing) {
      navigate(`/chat/${existing.id}`);
      setInspectingEntity(null);
    } else {
      // Create new conversation
      handleCreateWorkstream({
        name: '',
        participants: [currentUser.id, entityId],
        isGroup: false,
      });
      setInspectingEntity(null);
    }
  }, [conversations, currentUser.id, navigate, handleCreateWorkstream]);

  // Logout
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-tertiary text-xxs font-bold uppercase tracking-widest">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-bg-base overflow-hidden">
      {/* Ambient Glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(224, 122, 95, 0.08), transparent 60%)',
        }}
      />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 btn-icon btn-ghost bg-bg-elevated border border-border-default"
      >
        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 768) && (
          <motion.div
            initial={{ x: -340 }}
            animate={{ x: 0 }}
            exit={{ x: -340 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed md:relative z-40 h-full"
          >
            <Sidebar
              conversations={conversations}
              activeConvId={conversationId}
              onSelectConv={handleSelectConversation}
              entities={entities}
              currentUser={currentUser}
              onToggleStatus={() => {
                // Toggle user status (demo only)
                const statuses = ['online', 'away', 'busy', 'offline'] as const;
                const currentIdx = statuses.indexOf(currentUser.status as any || 'online');
                const nextStatus = statuses[(currentIdx + 1) % statuses.length];
                setEntities(prev => prev.map(e => 
                  e.id === currentUser.id ? { ...e, status: nextStatus } : e
                ));
              }}
              onInspectEntity={handleInspectEntity}
              onNewEntity={handleNewConversation}
              onLogout={handleLogout}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 h-full z-10 relative">
        {activeConversation ? (
          <ChatView
            conversation={activeConversation}
            messages={currentMessages}
            entities={entities}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onBack={() => navigate('/')}
            onInspectEntity={handleInspectEntity}
            onViewJobDetails={(jobId) => setOpenJobId(jobId)}
            isTyping={isTyping}
          />
        ) : (
          <WelcomeScreen
            user={currentUser}
            conversations={conversations}
            entities={entities}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        )}
      </div>

      {/* Modals */}
      <NewWorkstreamModal
        isOpen={isNewWorkstreamOpen}
        onClose={() => setIsNewWorkstreamOpen(false)}
        onSubmit={handleCreateWorkstream}
        entities={entities}
        currentUserId={currentUser.id}
      />

      <EntityProfileModal
        isOpen={!!inspectingEntity}
        onClose={() => setInspectingEntity(null)}
        entity={inspectingEntity}
        onStartChat={handleStartChatFromProfile}
      />
    </div>
  );
};

export default ChatPage;

