/**
 * Onboarding Page - After registration, user must:
 * 1. Create a new tenant, OR
 * 2. Join existing tenant with invite code
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Users, ArrowRight, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { api } from '../services/apiClient';
import toast from 'react-hot-toast';

// Types for tenant API responses
interface TenantInfo {
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

interface CreateTenantResponse {
  tenant: TenantInfo;
  invite_code: string;
}

interface JoinTenantResponse {
  tenant: TenantInfo;
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Create tenant
  const [tenantName, setTenantName] = useState('');
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  
  // Join tenant
  const [inviteCode, setInviteCode] = useState('');

  const handleCopyInviteCode = () => {
    if (createdInviteCode) {
      navigator.clipboard.writeText(createdInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Invite code copied!');
    }
  };

  const handleCreateTenant = async () => {
    if (!tenantName.trim()) {
      toast.error('Enter a name for your organization');
      return;
    }

    setIsLoading(true);
    try {
      // Call the tenant API - no demo fallback, real persistence only
      const response = await api.post<CreateTenantResponse>('/tenant', {
        name: tenantName
      });
      
      const { tenant, invite_code } = response;
      
      // Save to localStorage for quick access
      localStorage.setItem('ubl_tenant_id', tenant.tenant_id);
      localStorage.setItem('ubl_tenant_name', tenant.name);
      localStorage.setItem('ubl_tenant_role', 'owner');
      localStorage.setItem('ubl_tenant_invite_code', invite_code);
      
      // Show invite code for sharing
      setCreatedInviteCode(invite_code);
      toast.success(`${tenantName} created!`);
    } catch (err: any) {
      console.error('Create tenant error:', err);
      const errorMsg = err.message || err.response?.data?.error || 'Failed to create organization';
      
      if (errorMsg.includes('already has a tenant')) {
        toast.error('You already belong to an organization');
        navigate('/');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueAfterCreate = () => {
    navigate('/');
  };

  const handleJoinTenant = async () => {
    if (!inviteCode.trim()) {
      toast.error('Enter an invite code');
      return;
    }

    setIsLoading(true);
    try {
      // Call the tenant join API - no demo fallback, real persistence only
      const response = await api.post<JoinTenantResponse>('/tenant/join', {
        code: inviteCode.toUpperCase().trim()
      });
      
      const { tenant } = response;
      
      localStorage.setItem('ubl_tenant_id', tenant.tenant_id);
      localStorage.setItem('ubl_tenant_name', tenant.name);
      localStorage.setItem('ubl_tenant_role', 'member');
      
      toast.success(`Joined ${tenant.name}!`);
      navigate('/');
    } catch (err: any) {
      console.error('Join tenant error:', err);
      const errorMsg = err.message || err.response?.data?.error || 'Failed to join';
      
      if (errorMsg.includes('Invalid') || errorMsg.includes('expired')) {
        toast.error('Invalid or expired invite code');
      } else if (errorMsg.includes('already')) {
        toast.error('You already belong to an organization');
        navigate('/');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div 
            className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Sparkles className="w-8 h-8 text-accent" />
          </motion.div>
          <h1 className="text-2xl font-black text-text-primary mb-2">
            Welcome to UBL Messenger
          </h1>
          <p className="text-text-tertiary text-sm">
            Let's get you set up
          </p>
        </div>

        {/* Choice View */}
        {mode === 'choice' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <button
              onClick={() => setMode('create')}
              className="w-full p-5 bg-bg-elevated border border-transparent hover:border-accent rounded-2xl transition-all group text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                  <Building2 className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-text-primary mb-1">
                    Create Organization
                  </h3>
                  <p className="text-sm text-text-tertiary">
                    Start fresh with your own workspace
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-text-tertiary group-hover:text-accent transition-colors mt-1" />
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full p-5 bg-bg-elevated border border-transparent hover:border-accent rounded-2xl transition-all group text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center flex-shrink-0 group-hover:bg-info/20 transition-colors">
                  <Users className="w-6 h-6 text-info" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-text-primary mb-1">
                    Join with Invite Code
                  </h3>
                  <p className="text-sm text-text-tertiary">
                    Enter a code to join an existing team
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-text-tertiary group-hover:text-info transition-colors mt-1" />
              </div>
            </button>
          </motion.div>
        )}

        {/* Create Tenant View */}
        {mode === 'create' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {!createdInviteCode ? (
              <>
                <button
                  onClick={() => setMode('choice')}
                  className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
                >
                  ← Back
                </button>

                <div>
                  <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={e => setTenantName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-3 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleCreateTenant}
                  disabled={isLoading || !tenantName.trim()}
                  className="w-full py-4 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white font-bold text-sm uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-3"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Building2 className="w-5 h-5" />
                      Create Organization
                    </>
                  )}
                </button>
              </>
            ) : (
              // Show invite code after creation
              <>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-success" />
                  </div>
                  <h2 className="text-xl font-bold text-text-primary mb-2">
                    {tenantName} Created!
                  </h2>
                  <p className="text-sm text-text-tertiary">
                    Share this invite code with your team
                  </p>
                </div>

                <div className="bg-bg-elevated border border-border-default rounded-2xl p-6">
                  <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-3 text-center">
                    Invite Code
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 bg-bg-base border border-border-default rounded-xl text-center font-mono text-xl tracking-widest text-text-primary">
                      {createdInviteCode}
                    </div>
                    <button
                      onClick={handleCopyInviteCode}
                      className="p-3 bg-bg-base border border-border-default rounded-xl hover:border-accent transition-all"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-success" />
                      ) : (
                        <Copy className="w-5 h-5 text-text-tertiary" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleContinueAfterCreate}
                  className="w-full py-4 bg-accent hover:bg-accent-hover text-white font-bold text-sm uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-3"
                >
                  Continue to Messenger
                  <ArrowRight className="w-5 h-5" />
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* Join Tenant View */}
        {mode === 'join' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <button
              onClick={() => setMode('choice')}
              className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
            >
              ← Back
            </button>

            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="ABCD-1234"
                className="w-full px-4 py-3 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-center font-mono text-lg tracking-widest"
                autoFocus
                maxLength={9}
              />
            </div>

            <button
              onClick={handleJoinTenant}
              disabled={isLoading || !inviteCode.trim()}
              className="w-full py-4 bg-info hover:bg-info/90 disabled:bg-info/50 text-white font-bold text-sm uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Join Team
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-text-tertiary mt-8">
          You can invite team members later
        </p>
      </motion.div>
    </div>
  );
};

export default OnboardingPage;
