/**
 * Error Boundary Component
 * Catches React errors and displays a friendly fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
    
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-error/10 border border-error/20 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-error" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-text-primary mb-3">
              Something went wrong
            </h1>
            
            {/* Description */}
            <p className="text-text-secondary text-sm mb-8">
              An unexpected error occurred. Please try again or contact support if the problem persists.
            </p>

            {/* Error Details (dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-8 p-4 bg-bg-surface rounded-xl border border-border-subtle text-left">
                <p className="text-xxs font-bold text-text-tertiary uppercase tracking-wider mb-2">
                  Error Details
                </p>
                <code className="text-xs text-error font-mono break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={this.handleGoHome}
                className="flex-1"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
              <Button
                variant="primary"
                onClick={this.handleRetry}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

