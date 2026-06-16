import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  source?: string;
}

interface State {
  error: Error | null;
}

/** Top-level error boundary so a render/scene crash shows a readable overlay
 *  instead of a blank canvas — important for the unattended build loop. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[Blobolines:${this.props.source ?? "app"}]`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
          <h1 className="font-display text-2xl text-danger">A blob went splat.</h1>
          <p className="max-w-md font-ui text-sm text-fg-muted">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-display text-sm text-bg"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
