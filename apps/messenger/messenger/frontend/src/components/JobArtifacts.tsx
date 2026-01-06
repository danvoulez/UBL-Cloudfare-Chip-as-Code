/**
 * Job Artifacts Component
 * 
 * Displays artifacts produced by jobs (files, links, records)
 */

import React from 'react';
import { File, Link as LinkIcon, Database, Quote } from 'lucide-react';

interface Artifact {
  artifact_id: string;
  kind: string;
  title: string;
  url?: string;
  mime_type?: string;
  size_bytes?: number;
  created_at: string;
}

interface JobArtifactsProps {
  artifacts: Artifact[];
}

export const JobArtifacts: React.FC<JobArtifactsProps> = ({ artifacts }) => {
  const getArtifactIcon = (kind: string) => {
    switch (kind) {
      case 'file': return <File className="w-5 h-5 text-blue-500" />;
      case 'link': return <LinkIcon className="w-5 h-5 text-green-500" />;
      case 'record': return <Database className="w-5 h-5 text-purple-500" />;
      case 'quote': return <Quote className="w-5 h-5 text-yellow-500" />;
      default: return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpen = (artifact: Artifact) => {
    if (artifact.url) {
      window.open(artifact.url, '_blank');
    }
  };

  const handleCopy = (artifact: Artifact) => {
    if (artifact.url) {
      navigator.clipboard.writeText(artifact.url);
    }
  };

  return (
    <div className="space-y-2">
      {artifacts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No artifacts yet</p>
      ) : (
        artifacts.map((artifact) => (
          <div
            key={artifact.artifact_id}
            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex-shrink-0">
              {getArtifactIcon(artifact.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {artifact.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {artifact.kind}
                </span>
                {artifact.size_bytes && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    • {formatSize(artifact.size_bytes)}
                  </span>
                )}
                {artifact.mime_type && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    • {artifact.mime_type}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {artifact.url && (
                <>
                  <button
                    onClick={() => handleOpen(artifact)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Open"
                  >
                    <LinkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleCopy(artifact)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Copy URL"
                  >
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

