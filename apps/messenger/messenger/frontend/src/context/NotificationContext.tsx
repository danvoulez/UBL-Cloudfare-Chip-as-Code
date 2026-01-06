
import React, { createContext, useContext, useState, useCallback } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'ledger';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  notify: (n: Omit<Notification, 'id'>) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = useCallback((n: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newNotification = { ...n, id };
    setNotifications(prev => [...prev, newNotification]);
    
    if (n.duration !== 0) {
      setTimeout(() => dismiss(id), n.duration || 5000);
    }
  }, [dismiss]);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
      {/* Toast Portal Area */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col space-y-3 w-80 pointer-events-none">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className="pointer-events-auto bg-white border border-slate-200 shadow-2xl rounded-xl p-4 flex items-start animate-slide-up"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 ${
              n.type === 'error' ? 'bg-red-50 text-red-600' : 
              n.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
              n.type === 'ledger' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <i className={`fas ${
                n.type === 'error' ? 'fa-circle-xmark' : 
                n.type === 'success' ? 'fa-circle-check' :
                n.type === 'ledger' ? 'fa-cube' : 'fa-circle-info'
              }`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">{n.title}</h4>
              <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">{n.message}</p>
            </div>
            <button onClick={() => dismiss(n.id)} className="ml-3 text-slate-300 hover:text-slate-500">
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
