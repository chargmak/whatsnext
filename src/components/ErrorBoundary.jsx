import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, resetKey: props.resetKey };
        this.reset = this.reset.bind(this);
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    // Auto-recover when the caller's resetKey changes (we pass the current route).
    // Without this, a single crashing screen latches hasError forever and every
    // subsequent page renders the fallback — indistinguishable from a dead app.
    static getDerivedStateFromProps(props, state) {
        if (props.resetKey !== state.resetKey) {
            return { hasError: false, resetKey: props.resetKey };
        }
        return null;
    }

    componentDidCatch(error, info) {
        console.error('Unhandled error:', error, info);
    }

    // Let a custom fallback retry in place without a full page reload.
    reset() {
        this.setState({ hasError: false });
    }

    render() {
        if (this.state.hasError) {
            // A caller can supply a compact, self-contained fallback so a fault in
            // non-critical chrome (like the floating install prompt) degrades to
            // a small recoverable affordance instead of replacing the whole page.
            if (this.props.fallback !== undefined) {
                return typeof this.props.fallback === 'function'
                    ? this.props.fallback(this.reset)
                    : this.props.fallback;
            }
            return (
                <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>
                    <h2>Something went wrong</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        An unexpected error occurred. Reloading usually fixes it.
                    </p>
                    <button className="action-btn primary" onClick={() => window.location.reload()}>
                        Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
