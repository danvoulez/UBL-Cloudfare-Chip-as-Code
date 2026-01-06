/**
 * Job Drawer Component
 * 
 * Displays job details in a slide-out drawer:
 * - Header (title, state, owner)
 * - Summary (goal, constraints)
 * - Actions (context-aware buttons)
 * - Timeline (state changes, tool calls, cards)
 * - Artifacts (files, links produced)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ublApi } from '../services/ublApi';
import { JobTimeline } from './JobTimeline';
import { JobArtifacts } from './JobArtifacts';

interface JobDrawerProps {
  jobId: string | null;
  onClose: () => void;
  tenantId?: string;
}

interface JobData {
  jobId: string;
  title: string;
  goal: string;
  state: string;
  owner: {
    entity_id: string;
    display_name: string;
    kind: string;
  };
  availableActions: Array<{
    button_id: string;
    label: string;
    action: any;
  }>;
  timeline: any[];
  artifacts: any[];
}

export const JobDrawer: React.FC<JobDrawerProps> = ({ jobId, onClose, tenantId = 'default' }) => {
  const [job, setJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const loadJob = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await ublApi.getJob({ jobId, tenantId });
        setJob(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load job');
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [jobId, tenantId]);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': case 'rejected': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'waiting_input': return 'bg-yellow-100 text-yellow-800';
      case 'proposed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'waiting_input': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (!jobId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {job?.title || 'Job Details'}
            </h2>
            {job && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStateColor(job.state)}`}>
                {getStateIcon(job.state)}
                {job.state.replace('_', ' ')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {job && (
            <>
              {/* Summary */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Goal</h3>
                <p className="text-gray-900 dark:text-white">{job.goal}</p>
              </div>

              {/* Owner */}
              <div className="mb-6 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Owner: <span className="font-medium">{job.owner.display_name}</span>
                </span>
              </div>

              {/* Actions */}
              {job.availableActions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.availableActions.map((action) => (
                      <button
                        key={action.button_id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        onClick={() => {
                          // TODO: Handle action
                          console.log('Action clicked:', action);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Timeline</h3>
                <JobTimeline items={job.timeline} />
              </div>

              {/* Artifacts */}
              {job.artifacts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Artifacts</h3>
                  <JobArtifacts artifacts={job.artifacts} />
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

