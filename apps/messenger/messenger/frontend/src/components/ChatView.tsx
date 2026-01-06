/**
 * UBL Messenger ChatView
 * Orange design + Properly wired architecture
 */

import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, Entity, Contact, MessagePart } from '../types';
import { Icons } from '../constants';
import JobCardRenderer from './cards/JobCardRenderer';
import { TaskCreationModal, TaskDraft } from './modals';

interface ChatViewProps {
  conversation: Conversation;
  messages: Message[];
  entities: Entity[];
  currentUser: Entity;
  onSendMessage: (content: string, type?: string) => void;
  onCreateTask?: (task: TaskDraft) => void;
  onBack?: () => void;
  onInspectEntity?: (entity: Entity, initialTab?: 'profile' | 'settings') => void;
  onViewJobDetails?: (jobId: string) => void;
  isTyping?: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  messages,
  entities,
  currentUser,
  onSendMessage,
  onCreateTask,
  onBack,
  onInspectEntity,
  onViewJobDetails,
  isTyping = false
}) => {
  const [inputText, setInputText] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get other participant info
  const otherParticipantId = !conversation?.isGroup 
    ? conversation?.participants?.find(p => p !== currentUser.id) 
    : null;
  const otherEntity = otherParticipantId 
    ? entities.find(e => e.id === otherParticipantId) 
    : null;
  
  const chatName = conversation?.isGroup 
    ? conversation.name 
    : (otherEntity?.name || 'Unknown');
  const chatAvatar = conversation?.isGroup 
    ? conversation.avatar 
    : otherEntity?.avatar;
  const isAgent = otherEntity?.type === 'agent';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, 'chat');
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateTask = (task: TaskDraft) => {
    if (onCreateTask) {
      onCreateTask(task);
    } else {
      // Fallback: send as a message with task metadata
      const taskMessage = `📋 **Nova Tarefa: ${task.title}**\n\n${task.description}${task.deadline ? `\n\n⏰ Prazo: ${new Date(task.deadline).toLocaleString()}` : ''}${task.estimatedCost ? `\n💰 Custo: ${task.estimatedCost}` : ''}`;
      onSendMessage(taskMessage, 'command');
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-base">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-bg-surface border border-border-subtle flex items-center justify-center mx-auto mb-6 text-accent shadow-xl">
            <Icons.Code />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-text-primary mb-2">Select a Workstream</h2>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Choose a context to begin</p>
        </div>
      </div>
    );
  }

  const headerSubtitle = conversation.isGroup 
    ? `${conversation.participants.length} participants` 
    : isAgent ? 'AI Agent • Online' : 'Online';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-base">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-bg-elevated min-h-[64px]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Back Button (Mobile) */}
          {onBack && (
            <button 
              onClick={onBack} 
              className="md:hidden w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-bg-hover rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}
          
          {/* Avatar */}
          <div 
            className="shrink-0 cursor-pointer" 
            onClick={() => {
              if (!conversation.isGroup && otherEntity && onInspectEntity) {
                onInspectEntity(otherEntity, 'profile');
              }
            }}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden border border-transparent hover:border-accent transition-colors ${
              isAgent ? 'bg-gradient-to-br from-accent/20 to-cream/10' : 'bg-bg-surface'
            }`}>
              {conversation.isGroup ? (
                <span className="text-info"><Icons.Group /></span>
              ) : chatAvatar ? (
                <img src={chatAvatar} alt={chatName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-accent"><Icons.Agent /></span>
              )}
            </div>
          </div>

          {/* Title */}
          <div 
            className="cursor-pointer" 
            onClick={() => {
              if (!conversation.isGroup && otherEntity && onInspectEntity) {
                onInspectEntity(otherEntity, 'profile');
              }
            }}
          >
            <h1 className="text-base font-bold text-text-primary truncate">{chatName}</h1>
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">{headerSubtitle}</p>
          </div>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-bg-hover hover:text-text-primary rounded-xl transition-colors" title="Call">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </button>
          <button className="w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-bg-hover hover:text-text-primary rounded-xl transition-colors" title="More">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar bg-[radial-gradient(circle_at_50%_0%,rgba(224,122,95,0.03),transparent_50%)]">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, idx) => {
            const isMe = msg.from === currentUser.id || msg.role === 'user';
            const sender = isMe ? currentUser : entities.find(e => e.id === msg.from) || otherEntity;
            
            return (
              <div 
                key={msg.id || idx} 
                className={`flex gap-3 animate-fade-in ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                {!isMe && (
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${
                    sender?.type === 'agent' ? 'bg-accent/10 text-accent' : 'bg-bg-surface'
                  }`}>
                    {sender?.avatar ? (
                      <img src={sender.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icons.Agent />
                    )}
                  </div>
                )}
                
                {/* Message Bubble */}
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name */}
                  {!isMe && (
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 ml-1">
                      {sender?.name || 'Unknown'}
                    </p>
                  )}
                  
                  {/* Content */}
                  <div className={`rounded-2xl px-4 py-3 ${
                    isMe 
                      ? 'bg-accent text-bg-base rounded-br-md' 
                      : 'bg-bg-elevated border border-border-subtle text-text-primary rounded-bl-md'
                  }`}>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Render parts if present */}
                    {msg.parts?.map((part, pIdx) => (
                      <div key={pIdx} className="mt-2">
                        {part.jobCard && (
                          <JobCardRenderer 
                            card={part.jobCard} 
                            onAction={(action) => onSendMessage(action)}
                            onViewDetails={onViewJobDetails}
                          />
                        )}
                        {part.code && (
                          <pre className="mt-2 p-3 bg-bg-base rounded-lg text-xs font-mono overflow-x-auto">
                            <code>{part.code}</code>
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Timestamp & Status */}
                  <div className={`flex items-center gap-2 mt-1 ${isMe ? 'justify-end mr-1' : 'ml-1'}`}>
                    <span className="text-[10px] text-text-tertiary">
                      {msg.timestamp instanceof Date 
                        ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    {isMe && msg.hash && (
                      <span className="text-[9px] text-text-tertiary font-mono opacity-50">
                        {msg.hash.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex-shrink-0 flex items-center justify-center">
                <Icons.Agent />
              </div>
              <div className="bg-bg-elevated border border-border-subtle rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <footer className="px-6 py-4 bg-bg-elevated">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-bg-surface border border-border-default rounded-2xl p-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
            {/* Task Button (+ to start a task) */}
            <button 
              onClick={() => setIsTaskModalOpen(true)}
              className="w-9 h-9 flex items-center justify-center text-accent hover:bg-accent/10 hover:text-accent rounded-xl transition-colors flex-shrink-0"
              title="Iniciar Tarefa"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            
            {/* Text Input */}
            <textarea 
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-text-primary text-[15px] resize-none max-h-32 placeholder-text-tertiary"
            />
            
            {/* Send Button */}
            <button 
              onClick={handleSend}
              disabled={!inputText.trim()}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${
                inputText.trim() 
                  ? 'bg-accent hover:bg-accent-hover text-bg-base shadow-glow' 
                  : 'bg-bg-hover text-text-tertiary cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          
          <p className="text-[10px] text-text-tertiary text-center mt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse-soft"></span>
              Ledger Synced
            </span>
            <span>•</span>
            <span className="font-mono">{messages.length} entries</span>
          </p>
        </div>
      </footer>

      {/* Task Creation Modal */}
      <TaskCreationModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        conversationContext={inputText.trim() || undefined}
      />
    </div>
  );
};

export default ChatView;
