import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error boundary caught an exception:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),transparent_24%),linear-gradient(160deg,#020617_0%,#050b16_45%,#0f172a_100%)] px-4 py-8 text-white">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-rose-400/25 bg-rose-400/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">Frontend Error</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">The UI hit a runtime error</h1>
            <p className="mt-3 text-sm leading-7 text-rose-100">
              {this.state.error?.message || 'Unknown React runtime error'}
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-200">
              Refresh after restarting the frontend. If the message persists, share this error text and we can fix it directly.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
