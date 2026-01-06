/**
 * Task Creation Modal
 * Like GitHub Issues: Title, Description, Deadline, Cost, Attachments
 * Any participant (human, agent, other human) can formalize a task
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Calendar, DollarSign, Paperclip, FileText, Trash2, Clock } from 'lucide-react';

export interface TaskDraft {
  title: string;
  description: string;
  deadline?: string;
  estimatedCost?: string;
  attachments: File[];
  priority: 'low' | 'normal' | 'high' | 'critical';
}

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskDraft) => void;
  conversationContext?: string; // Optional: Pre-fill from conversation
}

export const TaskCreationModal: React.FC<TaskCreationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  conversationContext,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(conversationContext || '');
  const [deadline, setDeadline] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [priority, setPriority] = useState<TaskDraft['priority']>('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      deadline: deadline || undefined,
      estimatedCost: estimatedCost || undefined,
      attachments,
      priority,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setDeadline('');
    setEstimatedCost('');
    setAttachments([]);
    setPriority('normal');
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const priorityColors = {
    low: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    normal: 'bg-info/10 text-info border-info/30',
    high: 'bg-warning/10 text-warning border-warning/30',
    critical: 'bg-error/10 text-error border-error/30',
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
            className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-bg-elevated border border-border-default rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-bg-elevated shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Iniciar Tarefa</h2>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                    Formalizar documento ou ação
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center text-text-tertiary hover:bg-bg-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                    Título *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Contrato de Prestação de Serviços..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                    Descrição
                  </label>
                  <textarea
                    placeholder="Descreva o que precisa ser feito, contexto, requisitos..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                    Prioridade
                  </label>
                  <div className="flex gap-2">
                    {(['low', 'normal', 'high', 'critical'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all ${
                          priority === p
                            ? priorityColors[p]
                            : 'bg-bg-surface border-border-default text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        {p === 'low' && 'Baixa'}
                        {p === 'normal' && 'Normal'}
                        {p === 'high' && 'Alta'}
                        {p === 'critical' && 'Crítica'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deadline & Cost Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Deadline */}
                  <div>
                    <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                      <Calendar className="w-3 h-3 inline-block mr-1" />
                      Prazo
                    </label>
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                    />
                  </div>

                  {/* Estimated Cost */}
                  <div>
                    <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                      <DollarSign className="w-3 h-3 inline-block mr-1" />
                      Custo Estimado
                    </label>
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                    <Paperclip className="w-3 h-3 inline-block mr-1" />
                    Anexos
                  </label>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleAddFiles}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />

                  {/* File List */}
                  {attachments.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-bg-surface border border-border-subtle rounded-lg"
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                            <p className="text-[10px] text-text-tertiary">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(idx)}
                            className="w-8 h-8 flex items-center justify-center text-error hover:bg-error/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 bg-bg-surface border border-dashed border-border-default/50 hover:border-accent/50 rounded-xl text-text-secondary hover:text-accent transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Adicionar Arquivo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 shrink-0 bg-bg-surface">
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 bg-bg-hover border border-border-default text-text-primary font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all hover:bg-bg-active"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim()}
                  className="flex-1 py-3 bg-accent hover:bg-accent-hover disabled:bg-bg-surface disabled:text-text-tertiary text-bg-base font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-glow"
                >
                  Criar Rascunho
                </button>
              </div>
              <p className="text-[10px] text-text-tertiary text-center mt-3">
                <Clock className="w-3 h-3 inline-block mr-1" />
                O outro participante precisará aprovar para iniciar
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TaskCreationModal;
