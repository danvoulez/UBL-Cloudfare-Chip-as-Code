/**
 * Job Timeline Component
 * 
 * Displays timeline of job events (state changes, tool calls, cards)
 */

import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Wrench, MessageSquare } from 'lucide-react';

interface TimelineItem {
  cursor: string;
  item_type: string;
  item_data: any;
  created_at: string;
}

interface JobTimelineProps {
  items: TimelineItem[];
}

export const JobTimeline: React.FC<JobTimelineProps> = ({ items }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (cursor: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(cursor)) {
        next.delete(cursor);
      } else {
        next.add(cursor);
      }
      return next;
    });
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'job_created': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'state_changed': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'tool_called': return <Wrench className="w-4 h-4 text-purple-500" />;
      case 'tool_result': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'approval_decided': return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No timeline events yet</p>
      ) : (
        items.map((item, index) => {
          const isExpanded = expandedItems.has(item.cursor);
          const data = item.item_data;

          return (
            <div
              key={item.cursor}
              className="flex gap-4 pb-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4"
            >
              <div className="flex-shrink-0 mt-1">
                {getItemIcon(item.item_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {data.title || data.type || 'Event'}
                    </p>
                    {data.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {data.description}
                      </p>
                    )}
                    {data.from && data.to && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {data.from} → {data.to}
                      </p>
                    )}
                    {data.tool_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Tool: {data.tool_name}
                      </p>
                    )}
                    {data.status && (
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${
                        data.status === 'success' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {data.status}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 ml-4">
                    {formatTimestamp(item.created_at)}
                  </span>
                </div>
                {(data.inputs || data.outputs) && (
                  <button
                    onClick={() => toggleExpand(item.cursor)}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>
                )}
                {isExpanded && (data.inputs || data.outputs) && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
                    {data.inputs && (
                      <div className="mb-2">
                        <strong>Inputs:</strong>
                        <pre className="mt-1 text-gray-700 dark:text-gray-300">
                          {JSON.stringify(data.inputs, null, 2)}
                        </pre>
                      </div>
                    )}
                    {data.outputs && (
                      <div>
                        <strong>Outputs:</strong>
                        <pre className="mt-1 text-gray-700 dark:text-gray-300">
                          {JSON.stringify(data.outputs, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

