/**
 * Settings Page
 * User preferences and account settings
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Moon,
  Sun,
  Bell,
  Volume2,
  Shield,
  LogOut,
  ChevronRight,
  User,
  Palette,
  Database,
} from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import { Button, Avatar } from '../components/ui';
import toast from 'react-hot-toast';

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  description,
  action,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 hover:bg-bg-hover rounded-xl transition-colors text-left group"
    disabled={!onClick && !action}
  >
    <div className="w-10 h-10 rounded-xl bg-bg-surface border border-border-subtle flex items-center justify-center text-text-tertiary group-hover:text-accent transition-colors">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-text-primary">{label}</p>
      {description && (
        <p className="text-xs text-text-tertiary truncate">{description}</p>
      )}
    </div>
    {action || (onClick && <ChevronRight className="w-5 h-5 text-text-tertiary" />)}
  </button>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-12 h-7 rounded-full transition-colors relative ${
      checked ? 'bg-accent' : 'bg-bg-hover'
    }`}
  >
    <div
      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isDemoMode } = useAuthContext();

  const [settings, setSettings] = useState({
    darkMode: true,
    notifications: true,
    sounds: true,
    glowIntensity: 0.6,
  });

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-elevated/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="btn-icon btn-ghost"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <Avatar
              src={user?.avatar}
              alt={user?.displayName}
              size="xl"
              type={isDemoMode ? 'human' : 'human'}
            />
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user?.displayName}</h2>
              <p className="text-sm text-text-tertiary">
                {isDemoMode ? 'Demo Mode' : user?.sid}
              </p>
            </div>
            <Button variant="secondary" size="sm">
              <User className="w-4 h-4" />
              Edit
            </Button>
          </div>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="p-4 bg-bg-surface/50 rounded-t-xl">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
              Appearance
            </h3>
          </div>
          <div className="p-2">
            <SettingRow
              icon={settings.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              label="Dark Mode"
              description="Use dark theme"
              action={
                <Toggle
                  checked={settings.darkMode}
                  onChange={v => setSettings(s => ({ ...s, darkMode: v }))}
                />
              }
            />
            <SettingRow
              icon={<Palette className="w-5 h-5" />}
              label="Glow Intensity"
              description="Ambient lighting effect"
              action={
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.glowIntensity}
                  onChange={e => setSettings(s => ({ ...s, glowIntensity: parseFloat(e.target.value) }))}
                  className="w-24 accent-accent"
                />
              }
            />
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="p-4 bg-bg-surface/50 rounded-t-xl">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
              Notifications
            </h3>
          </div>
          <div className="p-2">
            <SettingRow
              icon={<Bell className="w-5 h-5" />}
              label="Push Notifications"
              description="Receive message alerts"
              action={
                <Toggle
                  checked={settings.notifications}
                  onChange={v => setSettings(s => ({ ...s, notifications: v }))}
                />
              }
            />
            <SettingRow
              icon={<Volume2 className="w-5 h-5" />}
              label="Sounds"
              description="Play notification sounds"
              action={
                <Toggle
                  checked={settings.sounds}
                  onChange={v => setSettings(s => ({ ...s, sounds: v }))}
                />
              }
            />
          </div>
        </motion.div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="p-4 bg-bg-surface/50 rounded-t-xl">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
              Security
            </h3>
          </div>
          <div className="p-2">
            <SettingRow
              icon={<Shield className="w-5 h-5" />}
              label="Passkeys"
              description="Manage your authentication credentials"
              onClick={() => toast('Coming soon')}
            />
            <SettingRow
              icon={<Database className="w-5 h-5" />}
              label="Connected Services"
              description="UBL API connection status"
              onClick={() => toast('Coming soon')}
            />
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="danger"
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </motion.div>

        {/* Version */}
        <p className="text-center text-xxs text-text-tertiary py-4">
          UBL Messenger v1.0.0
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;

