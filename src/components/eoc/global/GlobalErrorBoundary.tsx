'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[GlobalErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}]`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center p-4 bg-[#0a0e1a]/95 border border-red-900/40 rounded-lg m-2">
          <div className="text-center font-mono">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-red-400 text-[10px] tracking-widest font-bold">
                SYSTEM ERROR
              </span>
            </div>
            <div className="text-white/40 text-[10px] mb-1">
              {this.props.name || 'Component'} failed to render
            </div>
            {this.state.error && (
              <div className="text-white/25 text-[9px] max-w-xs truncate mb-3">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-widest bg-red-950/40 hover:bg-red-900/40 text-red-300 rounded border border-red-800/50 hover:border-red-700/60 transition-colors"
            >
              <RotateCcw size={10} />
              RETRY
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export { GlobalErrorBoundary };
export default GlobalErrorBoundary;
