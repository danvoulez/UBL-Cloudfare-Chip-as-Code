/**
 * Job Card Renderer
 * Displays job cards inline in chat with orange styling
 * Properly wired to UBL Kernel for approve/reject
 */

import React, { useState } from 'react';
import { JobCardData } from '../../types';
import { ublApi } from '../../services/ublApi';
import toast from 'react-hot-toast';

interface JobCardRendererProps {
  card: JobCardData;
  onAction?: (action: string) => void;
  onStatusChange?: (jobId: string, newStatus: string) => void;
  onViewDetails?: (jobId: string) => void;
}

const JobCardRenderer: React.FC<JobCardRendererProps> = ({ card, onAction, onStatusChange, onViewDetails }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(card.status);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await ublApi.approveJob(card.id);
      setLocalStatus('running');
      onStatusChange?.(card.id, 'running');
      toast.success('Job approved');
      onAction?.(`✅ Approved: ${card.title}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await ublApi.rejectJob(card.id);
      setLocalStatus('cancelled');
      onStatusChange?.(card.id, 'cancelled');
      toast.error('Job rejected');
      onAction?.(`❌ Rejected: ${card.title}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setIsLoading(false);
    }
  };

  // Use local status for display
  const displayStatus = localStatus;
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { 
          bg: 'bg-warning/10', 
          text: 'text-warning', 
          border: 'border-warning/30',
          icon: '⏳',
          label: 'Pending'
        };
      case 'running':
        return { 
          bg: 'bg-info/10', 
          text: 'text-info', 
          border: 'border-info/30',
          icon: '🔄',
          label: 'Running'
        };
      case 'completed':
        return { 
          bg: 'bg-success/10', 
          text: 'text-success', 
          border: 'border-success/30',
          icon: '✅',
          label: 'Completed'
        };
      case 'failed':
        return { 
          bg: 'bg-error/10', 
          text: 'text-error', 
          border: 'border-error/30',
          icon: '❌',
          label: 'Failed'
        };
      default:
        return { 
          bg: 'bg-bg-surface', 
          text: 'text-text-secondary', 
          border: 'border-border-default',
          icon: '📋',
          label: status
        };
    }
  };

  const statusConfig = getStatusConfig(displayStatus);

  return (
    <div className={`mt-3 p-4 rounded-xl border ${statusConfig.border} bg-bg-base/50 backdrop-blur-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusConfig.icon}</span>
          <div>
            <div className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">
              Job #{card.id.slice(-6)}
            </div>
            <h4 className="text-sm font-bold text-text-primary">{card.title}</h4>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusConfig.bg} ${statusConfig.text}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Description */}
      {card.description && (
        <p className="text-[13px] text-text-secondary mb-3 leading-relaxed">
          {card.description}
        </p>
      )}

      {/* Progress Bar */}
      {(card.status === 'running' || card.progress > 0) && card.progress < 100 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
            <span>Progress</span>
            <span className="font-mono">{card.progress}%</span>
          </div>
          <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${card.progress}%` }}
            />
          </div>
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

      {/* Amount Badge */}
      {card.metadata?.amount && (
        <div className="mb-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="text-[10px] text-accent font-bold uppercase tracking-wider mb-0.5">Total Amount</div>
          <div className="text-lg font-black text-accent">{card.metadata.amount}</div>
        </div>
      )}

      {/* Duration */}
      {card.duration && (
        <div className="text-[11px] text-text-tertiary mb-3">
          <span className="opacity-70">Duration:</span> {card.duration}
        </div>
      )}

      {/* Actions */}
      {displayStatus === 'pending' && (
        <div className="flex gap-2 mt-4 pt-1">
          <button 
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 py-2 px-3 bg-success/10 hover:bg-success/20 text-success text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
          <button 
            onClick={handleReject}
            disabled={isLoading}
            className="flex-1 py-2 px-3 bg-error/10 hover:bg-error/20 text-error text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Reject'}
          </button>
        </div>
      )}

      {/* View Result Button */}
      {card.status === 'completed' && card.metadata?.resultUrl && (
        <a 
          href={card.metadata.resultUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 py-2 px-4 bg-accent hover:bg-accent-hover text-bg-base text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors"
        >
          <span>View Result</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      )}
    </div>
  );
};

export default JobCardRenderer;

