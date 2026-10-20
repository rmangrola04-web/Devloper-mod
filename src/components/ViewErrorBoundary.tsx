import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

interface ViewErrorBoundaryProps {
  children: ReactNode;
  viewName?: string;
  onResetView?: () => void;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`[ViewErrorBoundary] Caught rendering exception in view "${this.props.viewName || 'Module'}":`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onResetView) {
      this.props.onResetView();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[400px] p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 my-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {this.props.viewName ? `Module Temporary Render Issue (${this.props.viewName})` : 'Module Temporary Render Issue'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              An unexpected layout or state exception was safely isolated. The rest of your WMS portal remains online and active.
            </p>
            {this.state.error && (
              <div className="mt-2 p-2.5 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 font-mono text-[11px] rounded-xl border border-red-200 dark:border-red-900/50 text-left overflow-x-auto max-h-28">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset & Reload View</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Reload Full App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
