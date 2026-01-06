/**
 * Acceptance Card
 * Displayed when a task is completed and awaiting human acceptance
 * Human must Accept or Dispute to finalize the document
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, FileCheck, Clock, GitBranch, Download, ExternalLink } from 'lucide-react';
import { JobCardData } from '../../types';
import toast from 'react-hot-toast';

interface AcceptanceCardProps {
  card: JobCardData;
  onAccept: (jobId: string) => Promise<void>;
  onDispute: (jobId: string, reason: string) => Promise<void>;
  artifacts?: { name: string; url: string; type: string }[];
  gitCommit?: { hash: string; message: string; url?: string };
}

export const AcceptanceCard: React.FC<AcceptanceCardProps> = ({
  card,
  onAccept,
  onDispute,
  artifacts = [],
  gitCommit,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [disputed, setDisputed] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(card.id);
      setAccepted(true);
      toast.success('Documento oficializado no Ledger');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao aceitar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error('Por favor, descreva o motivo da disputa');
      return;
    }
    setIsLoading(true);
    try {
      await onDispute(card.id, disputeReason);
      setDisputed(true);
      toast.success('Disputa registrada no Ledger');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao registrar disputa');
    } finally {
      setIsLoading(false);
    }
  };

  // Already finalized
  if (accepted || disputed) {
    return (
      <div className={`mt-3 p-4 rounded-xl border ${
        accepted 
          ? 'border-success/30 bg-success/5' 
          : 'border-error/30 bg-error/5'
      }`}>
        <div className="flex items-center gap-3">
          {accepted ? (
            <CheckCircle2 className="w-8 h-8 text-success" />
          ) : (
            <XCircle className="w-8 h-8 text-error" />
          )}
          <div>
            <h4 className="text-sm font-bold text-text-primary">
              {accepted ? 'Documento Oficializado' : 'Disputa Registrada'}
            </h4>
            <p className="text-[11px] text-text-tertiary">
              {accepted 
                ? 'Este documento foi aceito e registrado no Ledger permanentemente'
                : 'Uma disputa foi aberta para revisão'}
            </p>
          </div>
        </div>
        {gitCommit && (
          <div className="mt-3 p-2 bg-bg-surface/50 rounded-lg flex items-center gap-2 text-[11px] font-mono text-text-tertiary">
            <GitBranch className="w-3 h-3" />
            <span className="text-text-secondary">{gitCommit.hash.slice(0, 7)}</span>
            <span className="truncate flex-1">{gitCommit.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-success/30 bg-bg-base/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">
              Tarefa Concluída
            </div>
            <h4 className="text-sm font-bold text-text-primary">{card.title}</h4>
          </div>
        </div>
        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-success/10 text-success">
          Aguardando Aceite
        </span>
      </div>

      {/* Description / Summary */}
      {card.description && (
        <p className="text-[13px] text-text-secondary mb-3 leading-relaxed">
          {card.description}
        </p>
      )}

      {/* Duration */}
      {card.duration && (
        <div className="flex items-center gap-2 text-[11px] text-text-tertiary mb-3">
          <Clock className="w-3 h-3" />
          <span>Duração: {card.duration}</span>
        </div>
      )}

      {/* Artifacts */}
      {artifacts.length > 0 && (
        <div className="mb-3 p-3 bg-bg-surface/50 rounded-lg">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
            Artefatos Gerados
          </p>
          <div className="space-y-2">
            {artifacts.map((artifact, idx) => (
              <a
                key={idx}
                href={artifact.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-bg-hover rounded-lg hover:bg-bg-active transition-colors"
              >
                <Download className="w-4 h-4 text-accent" />
                <span className="text-sm text-text-primary flex-1">{artifact.name}</span>
                <span className="text-[10px] text-text-tertiary uppercase">{artifact.type}</span>
                <ExternalLink className="w-3 h-3 text-text-tertiary" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Git Commit Info */}
      {gitCommit && (
        <div className="mb-3 p-2 bg-bg-surface/50 rounded-lg flex items-center gap-2 text-[11px]">
          <GitBranch className="w-3 h-3 text-accent" />
          <span className="font-mono text-text-secondary">{gitCommit.hash.slice(0, 7)}</span>
          <span className="text-text-tertiary truncate flex-1">{gitCommit.message}</span>
          {gitCommit.url && (
            <a href={gitCommit.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Ver
            </a>
          )}
        </div>
      )}

      {/* Metadata Items */}
      {card.metadata?.items && card.metadata.items.length > 0 && (
        <div className="space-y-1.5 mb-3 p-2 rounded-lg bg-bg-surface/50">
          {card.metadata.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[12px]">
              <span className="text-text-tertiary">{item.label}</span>
              <span className="text-text-primary font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dispute Form */}
      {showDisputeForm ? (
        <div className="mb-3">
          <textarea
            placeholder="Descreva o motivo da disputa..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-bg-surface border border-error/30 rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-error focus:ring-2 focus:ring-error/20 transition-all resize-none text-sm"
            autoFocus
          />
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-2 pt-4 mt-1">
        {showDisputeForm ? (
          <>
            <button
              onClick={() => setShowDisputeForm(false)}
              className="flex-1 py-2.5 px-3 bg-bg-hover border border-border-default text-text-primary text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDispute}
              disabled={isLoading || !disputeReason.trim()}
              className="flex-1 py-2.5 px-3 bg-error/10 hover:bg-error/20 text-error text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : 'Confirmar Disputa'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 py-2.5 px-3 bg-success hover:bg-success/90 text-bg-base text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isLoading ? 'Processando...' : 'Aceitar e Oficializar'}
            </button>
            <button
              onClick={() => setShowDisputeForm(true)}
              disabled={isLoading}
              className="py-2.5 px-4 bg-error/10 hover:bg-error/20 text-error text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50"
            >
              Disputar
            </button>
          </>
        )}
      </div>

      {/* Info */}
      <p className="text-[10px] text-text-tertiary text-center mt-3">
        Ao aceitar, este documento será registrado permanentemente no Ledger
      </p>
    </div>
  );
};

export default AcceptanceCard;
