/**
 * Toast Configuration
 * Custom styled toasts matching the orange design system
 */

import { Toaster } from 'react-hot-toast';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export const ToastProvider: React.FC = () => (
  <Toaster
    position="top-right"
    gutter={12}
    containerStyle={{
      top: 20,
      right: 20,
    }}
    toastOptions={{
      duration: 4000,
      style: {
        background: '#161616',
        color: '#f5f5f5',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '16px 20px',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
      success: {
        iconTheme: {
          primary: '#4ade80',
          secondary: '#0f0f0f',
        },
        style: {
          borderColor: 'rgba(74, 222, 128, 0.2)',
        },
      },
      error: {
        iconTheme: {
          primary: '#f87171',
          secondary: '#0f0f0f',
        },
        style: {
          borderColor: 'rgba(248, 113, 113, 0.2)',
        },
      },
    }}
  />
);

// Custom toast icons (optional, for custom toasts)
export const toastIcons = {
  success: <CheckCircle className="w-5 h-5 text-success" />,
  error: <XCircle className="w-5 h-5 text-error" />,
  warning: <AlertCircle className="w-5 h-5 text-warning" />,
  info: <Info className="w-5 h-5 text-info" />,
};

