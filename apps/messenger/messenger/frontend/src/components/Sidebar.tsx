/**
 * UBL Messenger Sidebar
 * Orange design + Properly wired architecture
 */

import React, { useState } from 'react';
import { Conversation, Entity } from '../types';
import { Icons } from '../constants';

interface SidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConv: (id: string) => void;
  entities: Entity[];
  currentUser: Entity;
  onToggleStatus: () => void;
  onInspectEntity: (entity: Entity, initialTab?: 'profile' | 'settings') => void;
  onNewEntity: () => void;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  conversations, 
  activeConvId, 
  onSelectConv, 
  entities, 
  currentUser,
  onToggleStatus,
  onInspectEntity,
  onNewEntity,
  onLogout
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conv => {
    if (!conv || !conv.participants) return false;
    if (conv.isGroup) return (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const otherParticipantId = conv.participants.find(p => p !== currentUser?.id);
    const otherEntity = entities.find(e => e.id === otherParticipantId);
    return (otherEntity?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'away': return 'bg-warning';
      case 'busy': return 'bg-error';
      case 'offline': return 'bg-text-tertiary';
      default: return 'bg-success';
    }
  };

  return (
    <aside className="w-[340px] h-full bg-bg-elevated flex flex-col flex-shrink-0">
      {/* User Header */}
      <div className="p-5 bg-bg-elevated">
        <div 
          onClick={() => onInspectEntity(currentUser, 'profile')}
          className="flex items-center gap-3 p-3 -m-3 rounded-xl hover:bg-bg-hover cursor-pointer transition-all group"
        >
          <div className="relative w-12 h-12 flex-shrink-0">
            <img 
              src={currentUser.avatar} 
              alt="Profile" 
              className="w-full h-full rounded-xl object-cover border border-transparent group-hover:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
              title={`Status: ${currentUser.status || 'online'} (click to toggle)`}
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border border-bg-elevated rounded-full shadow-sm transition-colors ${getStatusColor(currentUser.status)}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-text-primary truncate">{currentUser.name}</div>
            <div className="text-[11px] font-bold text-accent uppercase tracking-wider">{currentUser.role || 'Entity'}</div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1 mt-4">
          <button 
            onClick={onNewEntity}
            className="w-9 h-9 flex items-center justify-center bg-accent hover:bg-accent-hover text-bg-base rounded-lg transition-all active:scale-90 shadow-glow" 
            title="New Workstream"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button 
            onClick={() => onInspectEntity(currentUser, 'settings')}
            className="w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-bg-hover hover:text-text-primary rounded-lg transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="w-9 h-9 flex items-center justify-center text-text-tertiary hover:bg-error/10 hover:text-error rounded-lg transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-5 my-4">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Search workstreams..." 
            className="w-full pl-10 pr-4 py-2.5 bg-bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Workstreams List */}
      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">
          Strategic Contexts
        </div>
        
        {filteredConversations.map(conv => {
          const isActive = activeConvId === conv.id;
          let name = conv.name;
          let avatar = conv.avatar;
          let isAgent = false;

          if (!conv.isGroup) {
            const otherParticipantId = conv.participants.find(p => p !== currentUser.id);
            const otherEntity = entities.find(e => e.id === otherParticipantId);
            name = otherEntity?.name || 'Unknown';
            avatar = otherEntity?.avatar || '';
            isAgent = otherEntity?.type === 'agent';
          }

          // Get presence status for non-group conversations
          const otherParticipantId = !conv.isGroup ? conv.participants.find(p => p !== currentUser.id) : null;
          const otherEntity = otherParticipantId ? entities.find(e => e.id === otherParticipantId) : null;
          const presenceStatus = otherEntity?.status || 'offline';
          const isWorking = presenceStatus === 'working';
          const isWaitingOnYou = false; // TODO: Implement waiting_on_you status

          return (
            <div 
              key={conv.id}
              onClick={() => onSelectConv(conv.id)}
              className={`group relative flex items-center gap-3 p-3 mb-1 rounded-xl cursor-pointer transition-all border-l-2 ${
                isActive 
                  ? 'bg-bg-active border-accent' 
                  : 'border-transparent hover:bg-bg-hover hover:border-accent/50'
              }`}
            >
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-r-full" />
              )}
              
              {/* Avatar */}
              <div className={`relative w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${
                conv.isGroup ? 'bg-info/10 text-info' : 
                isAgent ? 'bg-gradient-to-br from-accent/20 to-cream/10' : 
                'bg-bg-surface'
              }`}>
                {conv.isGroup ? (
                  <Icons.Group />
                ) : avatar ? (
                  <img src={avatar} className="w-full h-full object-cover" alt={name} />
                ) : (
                  <Icons.Agent />
                )}
                
                {/* Presence Indicator */}
                {!conv.isGroup && otherEntity && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border border-bg-elevated rounded-full shadow-sm ${getStatusColor(presenceStatus)}`} 
                       title={`${otherEntity.name}: ${presenceStatus}`} />
                )}
                
                {/* Unread Badge */}
                {conv.unreadCount && conv.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent rounded-full text-[10px] font-bold text-bg-base flex items-center justify-center shadow-md">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className={`text-sm font-semibold truncate ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                    {name}
                  </span>
                  <span className="text-[11px] text-text-tertiary ml-2 flex-shrink-0">
                    {conv.lastMessageTime || ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-[13px] truncate flex-1 ${conv.unreadCount ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                  {conv.lastMessage || 'No messages yet'}
                </p>
                  {isWaitingOnYou && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-warning/20 text-warning rounded font-bold uppercase tracking-wide flex-shrink-0">
                      Needs You
                    </span>
                  )}
                  {isWorking && otherEntity && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-info/20 text-info rounded font-bold uppercase tracking-wide flex-shrink-0">
                      Working
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center mb-4 text-accent">
              <Icons.Code />
            </div>
            <p className="text-sm font-semibold text-text-secondary mb-1">No workstreams found</p>
            <p className="text-[11px] text-text-tertiary">Create one to get started</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-bg-surface flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-tertiary font-mono uppercase tracking-wider">UBL v2.0.0</span>
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse-soft" />
          <span className="font-medium">Live</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
