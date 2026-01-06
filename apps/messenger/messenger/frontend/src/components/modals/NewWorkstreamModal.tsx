/**
 * New Workstream Modal
 * Create new conversation / workstream
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Users, User } from 'lucide-react';
import { Entity } from '../../types';

interface NewWorkstreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; participants: string[]; isGroup: boolean }) => void;
  entities: Entity[];
  currentUserId: string;
}

export const NewWorkstreamModal: React.FC<NewWorkstreamModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  entities,
  currentUserId,
}) => {
  const [mode, setMode] = useState<'select' | 'group'>('select');
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const availableEntities = entities.filter(e => e.id !== currentUserId);

  const handleSelectEntity = (entityId: string) => {
    if (mode === 'select') {
      // Direct conversation
      onSubmit({
        name: '',
        participants: [currentUserId, entityId],
        isGroup: false,
      });
      onClose();
    } else {
      // Toggle selection for group
      setSelectedParticipants(prev => 
        prev.includes(entityId) 
          ? prev.filter(id => id !== entityId)
          : [...prev, entityId]
      );
    }
  };

  const handleCreateGroup = () => {
    if (selectedParticipants.length < 2 || !groupName.trim()) return;
    
    onSubmit({
      name: groupName,
      participants: [currentUserId, ...selectedParticipants],
      isGroup: true,
    });
    
    // Reset
    setGroupName('');
    setSelectedParticipants([]);
    setMode('select');
    onClose();
  };

  const handleClose = () => {
    setMode('select');
    setGroupName('');
    setSelectedParticipants([]);
    onClose();
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
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md bg-bg-elevated border border-border-default rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-bg-elevated">
              <h2 className="text-lg font-bold text-text-primary">
                {mode === 'select' ? 'New Workstream' : 'Create Group'}
              </h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center text-text-tertiary hover:bg-bg-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 px-5 pt-4">
              <button
                onClick={() => setMode('select')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'select'
                    ? 'bg-accent text-bg-base'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
                }`}
              >
                <User className="w-4 h-4 inline-block mr-2" />
                Direct
              </button>
              <button
                onClick={() => setMode('group')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'group'
                    ? 'bg-accent text-bg-base'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
                }`}
              >
                <Users className="w-4 h-4 inline-block mr-2" />
                Group
              </button>
            </div>

            {/* Group Name Input */}
            {mode === 'group' && (
              <div className="px-5 pt-4">
                <input
                  type="text"
                  placeholder="Group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
            )}

            {/* Entity List */}
            <div className="px-5 py-4 max-h-[300px] overflow-y-auto custom-scrollbar">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
                {mode === 'select' ? 'Select Entity' : 'Add Participants'}
              </p>
              
              <div className="space-y-2">
                {availableEntities.map(entity => {
                  const isSelected = selectedParticipants.includes(entity.id);
                  
                  return (
                    <button
                      key={entity.id}
                      onClick={() => handleSelectEntity(entity.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-accent/10 border border-accent'
                          : 'bg-bg-surface border border-transparent hover:bg-bg-hover hover:border-accent/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${
                        entity.type === 'agent' ? 'bg-accent/10 text-accent' : 'bg-bg-hover'
                      }`}>
                        {entity.avatar ? (
                          <img src={entity.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold text-text-primary">{entity.name}</div>
                        <div className="text-[11px] text-text-tertiary capitalize">
                          {entity.type} • {entity.role || 'Entity'}
                        </div>
                      </div>
                      {mode === 'group' && isSelected && (
                        <div className="w-6 h-6 rounded-full bg-accent text-bg-base flex items-center justify-center">
                          <Plus className="w-4 h-4 rotate-45" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer (Group mode only) */}
            {mode === 'group' && (
              <div className="px-5 py-4 bg-bg-surface">
                <button
                  onClick={handleCreateGroup}
                  disabled={selectedParticipants.length < 2 || !groupName.trim()}
                  className="w-full py-3 bg-accent hover:bg-accent-hover disabled:bg-bg-surface disabled:text-text-tertiary text-bg-base font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all"
                >
                  Create Group ({selectedParticipants.length} selected)
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
