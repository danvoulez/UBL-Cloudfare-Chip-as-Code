/**
 * Bridge Configuration Screen
 * For setting up API connections
 */

import React, { useState } from 'react';
import { Icons } from '../constants';

interface BridgeConfigProps {
  onConfigured: () => void;
}

const BridgeConfig: React.FC<BridgeConfigProps> = ({ onConfigured }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!apiUrl.trim()) {
      setError('Please enter a valid API URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Test connection
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to API');
      }

      // Save config
      localStorage.setItem('ubl_api_base_url', apiUrl.replace(/\/$/, ''));
      onConfigured();
    } catch (err: any) {
      setError(err.message || 'Connection failed. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Use default/mock mode
    localStorage.setItem('ubl_api_base_url', '');
    onConfigured();
  };

  return (
    <div className="h-screen w-screen bg-bg-base flex items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_50%,rgba(224,122,95,0.08),transparent_70%)]">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-bg-elevated border border-border-subtle flex items-center justify-center mx-auto mb-6 shadow-xl">
            <div className="text-accent">
              <Icons.Code />
            </div>
          </div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight mb-2">
            Configure Bridge
          </h1>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-[0.2em]">
            Connect to your UBL Backend
          </p>
        </div>

        {/* Config Form */}
        <div className="bg-bg-elevated border border-border-default rounded-2xl p-8 shadow-xl">
          <div className="mb-6">
            <label className="block text-[10px] font-black text-text-tertiary uppercase tracking-wider mb-2">
              API Base URL
            </label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.your-domain.com"
              className="w-full px-4 py-3 bg-bg-surface border border-border-subtle rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full py-4 bg-accent hover:bg-accent-hover text-bg-base font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-glow disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect to Backend'
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-bg-elevated text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                or
              </span>
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="w-full py-4 bg-bg-surface hover:bg-bg-hover text-text-secondary font-bold uppercase tracking-widest text-[11px] rounded-xl border border-border-subtle transition-all"
          >
            Continue with Demo Mode
          </button>
        </div>

        {/* Info */}
        <p className="text-center mt-6 text-[10px] text-text-tertiary">
          Demo mode uses local storage. Your data won't persist across sessions.
        </p>
      </div>
    </div>
  );
};

export default BridgeConfig;
