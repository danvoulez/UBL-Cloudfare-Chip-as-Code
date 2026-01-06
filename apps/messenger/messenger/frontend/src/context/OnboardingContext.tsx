
import React, { createContext, useContext, useState } from 'react';
import { Tenant, UserSession, Entity } from '../types';
import { ublApi } from '../services/ublApi';

type OnboardingStep = 'welcome' | 'tenant' | 'profile' | 'syncing' | 'ready';

// Demo mode: skip backend calls when UBL is not available
const DEMO_MODE = false; // UBL is running - use real auth

interface OnboardingContextType {
  session: UserSession | null;
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  provisionTenant: (name: string, domain: string) => Promise<void>;
  joinTenant: (inviteCode: string) => Promise<void>;
  completeProfile: (userData: Partial<Entity>) => Promise<void>;
  updateMe: (patch: Partial<Entity>) => Promise<Entity>;
  logout: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('ubl_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          tenant: { ...parsed.tenant, createdAt: new Date(parsed.tenant.createdAt) }
        };
      } catch {
        // fall through
      }
    }
    // Auto-create demo session
    const demoUser: Entity = {
      id: 'user-admin',
      name: 'Admin',
      role: 'Operator',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=admin',
      status: 'online',
      type: 'human',
    };
    const demoTenant: Tenant = {
      id: 'T.UBL',
      name: 'UBL',
      domain: 'ubl',
      tier: 'free',
      createdAt: new Date(),
      inviteCode: 'UBL-ADMIN',
    };
    const autoSession: UserSession = {
      token: `auto-${Date.now()}`,
      user: demoUser,
      tenant: demoTenant,
    };
    localStorage.setItem('ubl_session', JSON.stringify(autoSession));
    return autoSession;
  });

  const [step, setStep] = useState<OnboardingStep>('ready');

  const provisionTenant = async (name: string, domain: string) => {
    if (DEMO_MODE) {
      // Demo: create fake tenant
      const tenant: Tenant = {
        id: `T.${domain.toUpperCase()}`,
        name,
        domain,
        tier: 'free',
        createdAt: new Date(),
        inviteCode: `UBL-DEMO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      };
      localStorage.setItem('ubl_pending_tenant', JSON.stringify(tenant));
      setStep('profile');
      return;
    }
    const tenant = await ublApi.provisionTenant(name, domain);
    localStorage.setItem('ubl_pending_tenant', JSON.stringify(tenant));
    setStep('profile');
  };

  const joinTenant = async (inviteCode: string) => {
    if (inviteCode.trim().length < 4) throw new Error('Invalid invite code');
    if (DEMO_MODE) {
      // Demo: create fake tenant from invite
      const tenant: Tenant = {
        id: 'T.DEMO',
        name: 'Demo Organization',
        domain: 'demo',
        tier: 'free',
        createdAt: new Date(),
        inviteCode,
      };
      localStorage.setItem('ubl_pending_tenant', JSON.stringify(tenant));
      setStep('profile');
      return;
    }
    const tenant = await ublApi.joinTenant(inviteCode);
    localStorage.setItem('ubl_pending_tenant', JSON.stringify(tenant));
    setStep('profile');
  };

  const completeProfile = async (userData: Partial<Entity>) => {
    const pendingTenant: Tenant = (() => {
      const raw = localStorage.getItem('ubl_pending_tenant');
      if (!raw) throw new Error('No tenant selected');
      const t = JSON.parse(raw);
      return { ...t, createdAt: new Date(t.createdAt) };
    })();

    setStep('syncing');
    
    if (DEMO_MODE) {
      // Demo: create fake session
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate sync
      const demoUser: Entity = {
        id: `user-${Math.random().toString(36).slice(2, 10)}`,
        name: userData.name || 'Demo User',
        role: userData.role || 'Developer',
        avatar: userData.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=demo`,
        status: 'online',
        type: 'human',
      };
      const newSession: UserSession = {
        token: `demo-token-${Date.now()}`,
        user: demoUser,
        tenant: pendingTenant,
      };
      setSession(newSession);
      localStorage.setItem('ubl_session', JSON.stringify(newSession));
      localStorage.removeItem('ubl_pending_tenant');
      setStep('ready');
      return;
    }
    
    try {
      const newSession = await ublApi.createSession({ tenantId: pendingTenant.id, user: userData });
      setSession(newSession);
      localStorage.setItem('ubl_session', JSON.stringify(newSession));
      localStorage.removeItem('ubl_pending_tenant');
      setStep('ready');
    } catch (e: any) {
      console.error('[Onboarding] createSession failed', e);
      setStep('profile');
      throw e;
    }
  };

  const updateMe = async (patch: Partial<Entity>) => {
    if (!session?.token) throw new Error('No active session');
    const updated = await ublApi.updateMe(patch);
    const nextSession = { ...session, user: updated };
    setSession(nextSession);
    localStorage.setItem('ubl_session', JSON.stringify(nextSession));
    return updated;
  };

  const logout = () => {
    localStorage.removeItem('ubl_session');
    setSession(null);
    setStep('welcome');
  };

  return (
    <OnboardingContext.Provider value={{
      session, step, setStep, provisionTenant, joinTenant, completeProfile, updateMe, logout
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
};
