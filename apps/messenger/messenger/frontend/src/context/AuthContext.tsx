/**
 * Auth Context Provider
 * Global authentication state management
 * 
 * Phase 4: Consolidated auth - now uses useAuth hook internally
 * to avoid code duplication and ensure PRF support
 */

import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';

// Re-export User type for convenience
export interface User {
  sid: string;
  username: string;
  displayName: string;
  kind: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  supportsWebAuthn: boolean;
  supportsPRF: boolean;
  canSignClientSide: boolean;
  error: string | null;
  registerPasskey: (username: string, displayName: string) => Promise<{ sid: string }>;
  loginWithPasskey: (username: string) => Promise<{ sid: string }>;
  loginDemo: () => void;
  logout: () => void;
  getPublicKeyForRegistration: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Hook to use auth context
 * Throws if used outside AuthProvider
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

/**
 * Auth Provider Component
 * Wraps the useAuth hook to provide global auth state
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use the consolidated useAuth hook
  const auth = useAuth();
  
  // Derive isDemoMode from user kind
  const isDemoMode = auth.user?.kind === 'demo';

  // Build context value
  const value: AuthContextType = {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    isDemoMode,
    supportsWebAuthn: auth.supportsWebAuthn,
    supportsPRF: auth.supportsPRF,
    canSignClientSide: auth.canSignClientSide,
    error: auth.error,
    registerPasskey: auth.registerPasskey,
    loginWithPasskey: auth.loginWithPasskey,
    loginDemo: auth.loginDemo,
    logout: auth.logout,
    getPublicKeyForRegistration: auth.getPublicKeyForRegistration,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

