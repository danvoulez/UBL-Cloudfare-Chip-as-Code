
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { JobCardData } from '../types';
import { jobsApi } from '../services/jobsApi';

interface JobCardProps {
  data: JobCardData;

  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}

const JobCard: React.FC<JobCardProps> = ({ data: initialData }) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleAction = async (action: 'approve' | 'abort' | 'download' | 'edit' | 'logs') => {
    setLoading(true);
    try {
      if (action === 'logs') {
        // TODO: Implement job logs via UBL API
        setLogs([`[${new Date().toLocaleTimeString()}] Job ${data.id} logs requested`]);
        setShowLogs(!showLogs);
      } else if (action === 'approve') {
        await jobsApi.approve(data.id);
        setData({ ...data, status: 'running' });
      } else if (action === 'abort') {
        await jobsApi.cancel(data.id);
        setData({ ...data, status: 'failed' });
      } else if (action === 'download') {
        alert("Iniciando download seguro via UBL Vault...");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'completed': return 'bg-success/10 text-success border-success/20';
      case 'failed': return 'bg-error/10 text-error border-error/20';
      case 'running': return 'bg-info/10 text-info border-info/20';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  return (
    <div className="bg-bg-surface border border-border-default rounded-lg p-5 max-w-[440px] my-3 animate-fade-in shadow-xl hover:border-border-strong transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
          data.type === 'formalization' ? 'bg-accent/10 text-accent' : 
          data.type === 'result' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
        }`}>
          {data.type === 'formalization' ? <Icons.Group /> : data.type === 'result' ? <Icons.Check /> : <Icons.Code />}
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusColor()}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${data.status === 'running' ? 'animate-pulse' : ''} ${
            data.status === 'completed' ? 'bg-success' : data.status === 'failed' ? 'bg-error' : data.status === 'running' ? 'bg-info' : 'bg-warning'
          }`} />
          {data.status.toUpperCase()}
        </div>
      </div>
      
      <h3 className="text-[15px] font-bold text-text-primary mb-1">{data.title}</h3>
      <p className="text-[13px] text-text-secondary leading-relaxed mb-4">{data.description}</p>
      
      {data.type === 'formalization' && data.metadata?.items && (
        <div className="space-y-2 mb-4 bg-bg-base/40 p-3 rounded-md border border-border-subtle">
          {data.metadata.items.map((item, i) => (
            <div key={i} className="flex justify-between text-[11px] font-mono">
              <span className="text-text-tertiary uppercase tracking-wider">{item.label}</span>
              <span className="text-cream">{item.value}</span>
            </div>
          ))}
          {data.metadata.amount && (
            <div className="pt-3 mt-3 flex justify-between font-bold text-accent text-sm">
              <span>LEDGER TOTAL</span>
              <span>{data.metadata.amount}</span>
            </div>
          )}
        </div>
      )}

      {data.type === 'progress' && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-text-tertiary mb-1 uppercase font-bold tracking-widest">
            <span>Progress Analytics</span>
            <span>{data.progress}%</span>
          </div>
          <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent to-cream transition-all duration-1000 ease-out" 
              style={{ width: `${data.progress}%` }} 
            />
          </div>
        </div>
      )}

      {showLogs && (
        <div className="bg-bg-base/80 p-3 rounded-md mb-4 font-mono text-[10px] text-text-secondary border border-border-subtle max-h-32 overflow-y-auto custom-scrollbar">
          {logs.map((log, i) => <div key={i} className="mb-1">{`> ${log}`}</div>)}
        </div>
      )}
      
      <div className="flex gap-2">
        {data.type === 'formalization' && data.status === 'pending' && (
          <>
            <button 
              onClick={() => handleAction('approve')} 
              disabled={loading} 
              className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent-hover text-bg-base text-[12px] font-bold rounded-md transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Sincronizando...' : 'Confirmar Execução'}
            </button>
            <button 
              onClick={() => handleAction('edit')}
              className="px-4 py-2.5 bg-bg-hover border border-border-default text-text-primary text-[12px] font-bold rounded-md"
            >
              Ajustar
            </button>
          </>
        )}

        {data.type === 'progress' && (
          <>
            <button 
              onClick={() => handleAction('logs')} 
              className="flex-1 py-2.5 px-4 bg-bg-surface hover:bg-bg-active border border-border-default text-text-primary text-[12px] font-bold rounded-md"
            >
              {showLogs ? 'Ocultar Monitor' : 'Monitorar Logs'}
            </button>
            <button 
              onClick={() => handleAction('abort')} 
              disabled={loading}
              className="py-2.5 px-4 bg-error/10 hover:bg-error/20 text-error border border-error/20 text-[12px] font-bold rounded-md"
            >
              Interromper
            </button>
          </>
        )}

        {data.type === 'result' && (
          <>
            <button 
              onClick={() => handleAction('download')} 
              className="flex-1 py-2.5 px-4 bg-success text-bg-base hover:bg-success/90 text-[12px] font-bold rounded-md transition-all active:scale-95"
            >
              Download Assets
            </button>
            <button className="px-4 py-2.5 bg-bg-hover border border-border-default text-text-primary text-[12px] font-bold rounded-md">
              Ver no Ledger
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JobCard;
