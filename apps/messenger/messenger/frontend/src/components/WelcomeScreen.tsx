/**
 * Welcome Screen
 * Displayed when no conversation is selected
 */

import React from 'react';
import { Entity, Conversation } from '../types';
import { Icons } from '../constants';

interface WelcomeScreenProps {
  user: Entity;
  conversations: Conversation[];
  entities: Entity[];
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onOpenSettings?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  user,
  conversations,
  entities,
  onSelectConversation,
  onNewConversation,
  onOpenSettings
}) => {
  const recentConversations = conversations.slice(0, 3);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg-base bg-[radial-gradient(circle_at_50%_30%,rgba(224,122,95,0.06),transparent_60%)]">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Logo */}
        <div className="w-24 h-24 rounded-3xl bg-bg-surface border border-border-subtle flex items-center justify-center mx-auto mb-8 shadow-xl">
          <div className="text-accent">
            <Icons.Code />
          </div>
        </div>

        {/* Greeting */}
        <h1 className="text-3xl font-black text-text-primary mb-2 tracking-tight">
          Welcome back, {user.name?.split(' ')[0] || 'Entity'}
        </h1>
        <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-[0.2em] mb-10">
          Select a workstream to continue
        </p>

        {/* Quick Access */}
        {recentConversations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em] mb-4">
              Recent Workstreams
            </h2>
            <div className="space-y-2">
              {recentConversations.map(conv => {
                let name = conv.name;
                let avatar = conv.avatar;
                let isAgent = false;

                if (!conv.isGroup) {
                  const otherParticipantId = conv.participants.find(p => p !== user.id);
                  const otherEntity = entities.find(e => e.id === otherParticipantId);
                  name = otherEntity?.name || 'Unknown';
                  avatar = otherEntity?.avatar;
                  isAgent = otherEntity?.type === 'agent';
                }

                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-transparent hover:border-accent hover:bg-bg-hover transition-all group"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ${
                      conv.isGroup ? 'bg-info/10 text-info' :
                      isAgent ? 'bg-accent/10 text-accent' :
                      'bg-bg-surface'
                    }`}>
                      {conv.isGroup ? (
                        <Icons.Group />
                      ) : avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icons.Agent />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-text-tertiary truncate">
                        {conv.lastMessage || 'No messages yet'}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-text-tertiary group-hover:text-accent transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onNewConversation}
            className="w-full py-4 px-6 bg-accent hover:bg-accent-hover text-bg-base font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-glow active:scale-95"
          >
            New Workstream
          </button>
          
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-full py-4 px-6 bg-bg-surface hover:bg-bg-hover text-text-secondary font-bold uppercase tracking-widest text-[11px] rounded-xl border border-border-subtle transition-all"
            >
              Protocol Settings
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-10 pt-6 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-black text-accent">{conversations.length}</div>
            <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Workstreams</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-success">{entities.filter(e => e.type === 'agent').length}</div>
            <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">AI Agents</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-info">{entities.filter(e => e.type === 'human').length}</div>
            <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Humans</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;

