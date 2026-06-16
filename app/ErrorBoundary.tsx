import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  source?: string;
}

interface State {
  // A thrown value may be a non-Error (string/object) — keep it as unknown and coerce later.
  error: unknown;
  hasError: boolean;
}

/** Top-level error boundary so a render/scene crash shows a readable overlay
 *  instead of a blank canvas — important for the unattended build loop. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[Blobolines:${this.props.source ?? "app"}]`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // JS can throw non-Error values (strings, objects), so `.message` may be absent —
      // coerce to a safe string before testing/displaying it.
      const err = this.state.error;
      const msg = err instanceof Error ? err.message : String(err);
      // WebGL context loss / Rapier-WASM init failures read as cryptic GL/wasm errors —
      // show a friendly cause for those instead of the raw message.
      const isGraphics = /webgl|context|wasm|rapier|gl_|shader/i.test(msg);
      return (
        // Tap anywhere to retry (mobile-first) — the whole screen is the retry target.
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="absolute inset-0 z-[60] flex w-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center"
        >
          <span className="font-display text-2xl text-danger">A blob went splat.</span>
          <span className="max-w-md font-ui text-sm text-fg-muted">
            {isGraphics
              ? "The graphics engine couldn't start on this device. Tap to try again."
              : msg}
          </span>
          <span className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-display text-sm text-bg">
            Tap to retry
          </span>
        </button>
      );
    }
    return this.props.children;
  }
}
