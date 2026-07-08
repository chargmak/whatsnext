import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Unhandled error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            // A caller can opt into a lighter fallback (e.g. null) so a crash in a
            // non-critical widget is contained without taking over the screen.
            if (this.props.fallback !== undefined) return this.props.fallback;
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
