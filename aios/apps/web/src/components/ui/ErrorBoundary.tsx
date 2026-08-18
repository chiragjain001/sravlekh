'use client';

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// React error boundary — catches render-time crashes gracefully.
// NEVER shows raw error messages to users in production.
// Provides retry and report actions.
//
// Usage:
//   <PageErrorBoundary>        // Full-page crash recovery
//     <TeacherDashboard />
//   </PageErrorBoundary>
//
//   <SectionErrorBoundary>     // Card-level error, doesn't crash the page
//     <BatchAnalytics />
//   </SectionErrorBoundary>

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError:   boolean;
  errorCode:  string | null;
}

interface ErrorBoundaryProps {
  children:   ReactNode;
  fallback?:  ReactNode;
  variant?:   'page' | 'section';
  onError?:   (error: Error) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorCode: null };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, errorCode: `ERR-${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
    this.props.onError?.(error);
    // TODO: Send to monitoring service (Sentry, etc.) in production
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const isSection = this.props.variant === 'section';

    return isSection ? (
      <SectionError
        errorCode={this.state.errorCode}
        onRetry={() => this.setState({ hasError: false, errorCode: null })}
      />
    ) : (
      <PageError
        errorCode={this.state.errorCode}
        onRetry={() => this.setState({ hasError: false, errorCode: null })}
      />
    );
  }
}

// ── Page-level error ──────────────────────────────────────────────────────────
function PageError({ errorCode, onRetry }: { errorCode: string | null; onRetry: () => void }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="text-center space-y-5 max-w-sm p-8">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-slate-800">Something went wrong</h1>
          <p className="text-[13px] text-slate-500 mt-2">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {errorCode && (
            <p className="text-[11px] text-slate-400 font-mono mt-1">Error code: {errorCode}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-[13px] font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section-level error (inside a card, doesn't crash the page) ───────────────
function SectionError({ errorCode, onRetry }: { errorCode: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 bg-rose-50/50 border border-rose-100 rounded-2xl text-center">
      <AlertTriangle className="w-6 h-6 text-rose-400" />
      <div>
        <p className="text-[13px] font-semibold text-rose-700">Failed to load this section</p>
        {errorCode && (
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{errorCode}</p>
        )}
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 text-[12px] font-bold rounded-xl hover:bg-rose-50 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

// ── Convenience wrappers ───────────────────────────────────────────────────────
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary variant="page">{children}</ErrorBoundary>;
}

export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary variant="section">{children}</ErrorBoundary>;
}
