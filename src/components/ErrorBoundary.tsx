import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error) {
    console.error('Fontainer ErrorBoundary caught error:', error);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let displayDetail = this.state.message;
    try {
      const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        displayDetail = `${parsed.error}${parsed.path ? ` (${parsed.operationType} ${parsed.path})` : ''}`;
      }
    } catch {
      // plain string message
    }

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F1F1F1] dark:bg-[#1B1B1B] p-6">
        <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-lg space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                Fontainer encountered an error
              </h1>
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 leading-relaxed break-words">
                {displayDetail}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              label="Dismiss"
              onClick={() => this.setState({ hasError: false, message: '' })}
            />
            <Button
              variant="primary"
              size="sm"
              label="Reload Workspace"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => window.location.reload()}
            />
          </div>
        </div>
      </div>
    );
  }
}
