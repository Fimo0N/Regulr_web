import { Component, type ReactNode } from 'react';

/**
 * Catches a crashed page instead of leaving a blank screen. The usual cause in
 * production: a new version was deployed while the app was open, so the old page
 * files it tries to load no longer exist. Reloading fetches the new version.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page crash">
        <h1 className="page-title">Something went wrong</h1>
        <p className="muted">Regulr may have just been updated. Reloading usually fixes it.</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
