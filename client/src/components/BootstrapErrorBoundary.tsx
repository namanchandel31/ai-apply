import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class BootstrapErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BootstrapErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-md space-y-3">
            <h1 className="text-xl font-semibold">Application failed to load</h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <p className="text-xs text-muted-foreground">
              Open DevTools Console for the stack trace. Ensure the API is running: npm run dev
              (port 5000).
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
