/**
 * Entity Profile Modal
 * View entity details and start chat
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Bot, User, Shield, Clock, Star } from 'lucide-react';
import { Entity } from '../../types';

interface EntityProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Entity | null;
  onStartChat?: (entityId: string) => void;
}

export const EntityProfileModal: React.FC<EntityProfileModalProps> = ({
  isOpen,
  onClose,
  entity,
  onStartChat,
}) => {
  if (!entity) return null;

  const isAgent = entity.type === 'agent';

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'away': return 'bg-warning';
      case 'busy': return 'bg-error';
      case 'offline': return 'bg-text-tertiary';
      default: return 'bg-success';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm bg-bg-elevated border border-border-default rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-text-tertiary hover:bg-bg-hover rounded-lg transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Avatar */}
            <div className="relative pt-8 pb-6 px-6 text-center bg-gradient-to-b from-accent/10 to-transparent">
              <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center overflow-hidden border border-white/30 ${
                isAgent ? 'border-accent bg-accent/10' : 'border-border-default bg-bg-surface'
              }`}>
                {entity.avatar ? (
                  <img src={entity.avatar} alt={entity.name} className="w-full h-full object-cover" />
                ) : isAgent ? (
                  <Bot className="w-10 h-10 text-accent" />
                ) : (
                  <User className="w-10 h-10 text-text-secondary" />
                )}
              </div>
              
              {/* Status Indicator */}
              <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-2 w-4 h-4 rounded-full border border-bg-elevated ${getStatusColor(entity.status)}`} />
            </div>

            {/* Info */}
            <div className="px-6 pb-6 text-center">
              <h2 className="text-xl font-bold text-text-primary mb-1">{entity.name}</h2>
              <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-4">
                {entity.role || (isAgent ? 'AI Agent' : 'Human')}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-bg-surface rounded-xl p-3">
                  <Shield className="w-4 h-4 text-info mx-auto mb-1" />
                  <div className="text-[10px] font-bold text-text-tertiary uppercase">Trust</div>
                  <div className="text-sm font-bold text-text-primary">{entity.trustScore || 100}%</div>
                </div>
                <div className="bg-bg-surface rounded-xl p-3">
                  <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
                  <div className="text-[10px] font-bold text-text-tertiary uppercase">Active</div>
                  <div className="text-sm font-bold text-text-primary">{entity.activeHours || '24'}h</div>
                </div>
                <div className="bg-bg-surface rounded-xl p-3">
                  <Star className="w-4 h-4 text-accent mx-auto mb-1" />
                  <div className="text-[10px] font-bold text-text-tertiary uppercase">Jobs</div>
                  <div className="text-sm font-bold text-text-primary">{entity.completedJobs || 0}</div>
                </div>
              </div>

              {/* Bio */}
              {entity.bio && (
                <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                  {entity.bio}
                </p>
              )}

              {/* Action Button */}
              {onStartChat && (
                <button
                  onClick={() => onStartChat(entity.id)}
                  className="w-full py-3 bg-accent hover:bg-accent-hover text-bg-base font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-glow flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Start Conversation
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
