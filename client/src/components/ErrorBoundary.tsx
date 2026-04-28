import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-level error boundary. Catches render-time exceptions in the React tree
 * (does NOT catch async errors, event handler errors, or server errors —
 * those are handled by TanStack Query / route-level try/catch).
 *
 * Without this, a single render crash takes down the whole app with a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    // Log so the user can copy/paste into a bug report.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
          <div className="max-w-lg w-full rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The page hit an unexpected error. You can try reloading. If it keeps happening, your saved
              data is safe — only the page failed.
            </p>
            <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Reload page</Button>
              <Button variant="outline" onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
