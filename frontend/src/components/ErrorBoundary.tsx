import { Component, type ReactNode } from "react";
import { ErrorState } from "./States";

/** Keeps a crash in one page from blanking the whole console. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[PayPilot] UI error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="py-10">
          <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}
