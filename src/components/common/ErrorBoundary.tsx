import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 text-center space-y-4 my-6 max-w-lg mx-auto shadow-2xl animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">
              {this.props.fallbackTitle || 'Không thể hiển thị mục này'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {this.state.error?.message || 'Đã xảy ra sự cố không mong muốn trong quá trình tải dữ liệu.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tải Lại Trang</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
