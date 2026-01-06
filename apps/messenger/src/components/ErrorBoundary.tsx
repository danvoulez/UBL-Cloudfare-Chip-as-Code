
import React from 'react';

type Props = { children: React.ReactNode, fallback?: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any) { console.error('ErrorBoundary:', err); }
  render() {
    if (this.state.hasError) return this.props.fallback ?? <div className="p-3 text-red-600">Something went wrong.</div>;
    return this.props.children;
  }
}
