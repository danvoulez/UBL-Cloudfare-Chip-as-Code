/**
 * Login Page - Simplified WebAuthn Passkey Authentication
 * Clean UBL Messenger branding
 * 
 * Phase 4: Now uses consolidated useAuthContext
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Fingerprint, Loader2, Send } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import { api } from '../services/apiClient';
import toast from 'react-hot-toast';

// API response type for tenant check
interface TenantResponse {
  tenant: {
    tenant_id: string;
    name: string;
    slug: string;
  };
  role: string;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPasskey, registerPasskey, isLoading } = useAuthContext();
  
  const [email, setEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Check if user has tenant via API and localStorage
  const checkAndNavigate = async () => {
    try {
      // Try to get tenant from API
      const response = await api.get<TenantResponse>('/tenant');
      
      // User has tenant - save to localStorage and go to app
      localStorage.setItem('ubl_tenant_id', response.tenant.tenant_id);
      localStorage.setItem('ubl_tenant_name', response.tenant.name);
      localStorage.setItem('ubl_tenant_role', response.role);
      navigate('/');
    } catch (err: any) {
      // No tenant - go to onboarding
      console.log('No tenant found, redirecting to onboarding');
      navigate('/onboarding');
    }
  };

  // Login: usuário que já tem passkey
  const handlePasskeyLogin = async () => {
    try {
      // WebAuthn permite login sem username - o browser mostra as passkeys disponíveis
      await loginWithPasskey('');
      toast.success('Welcome back!');
      // Check tenant status via API
      await checkAndNavigate();
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    }
  };

  // Register: novo usuário digita email, cria passkey
  const handleRegister = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }

    setIsRegistering(true);
    try {
      // Usa email como username e display name
      // registerPasskey agora faz auto-login e retorna sessionToken
      const result = await registerPasskey(email, email.split('@')[0]) as { sid: string; username: string; sessionToken?: string };
      
      if (result.sessionToken) {
        toast.success('Account created! Welcome!');
        // New users always go to onboarding
        navigate('/onboarding');
      } else {
        // Fallback: se não tiver session_token, precisa login manual
        toast.success('Passkey created! Please sign in.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email.trim()) {
      handleRegister();
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10 flex flex-col items-center"
      >
        {/* Logo */}
        <motion.img 
          src="/images/ubl-messenger-logo.png"
          alt="UBL Messenger"
          className="w-72 h-auto mb-12"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400 }}
        />

        {/* Sign In Button */}
        <button
          onClick={handlePasskeyLogin}
          disabled={isLoading && !isRegistering}
          className="w-full py-4 px-6 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white font-bold text-sm uppercase tracking-wider rounded-2xl transition-all shadow-glow flex items-center justify-center gap-3"
        >
          {isLoading && !isRegistering ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Fingerprint className="w-5 h-5" />
          )}
          Sign in with Passkey
        </button>

        {/* Or Register */}
        <p className="text-text-primary text-sm font-medium my-6">
          Or Register →
        </p>

        {/* Email Input + Send Button */}
        <div className="w-full flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="your@email.com"
            className="flex-1 px-4 py-3 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm"
            autoComplete="email"
          />
          <button
            onClick={handleRegister}
            disabled={isRegistering || !email.trim()}
            className="px-5 py-3 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded-xl transition-all flex items-center justify-center"
          >
            {isRegistering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Subtle footer */}
        <p className="text-text-tertiary text-[10px] mt-8 text-center">
          Secure authentication powered by WebAuthn
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;

