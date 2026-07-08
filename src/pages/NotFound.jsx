import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="container" style={{ paddingTop: '100px', paddingBottom: '100px', textAlign: 'center' }}>
            <Film size={64} color="var(--brand-600)" style={{ marginBottom: '16px' }} />
            <h1 style={{ fontSize: '3rem', margin: '0 0 8px' }}>404</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                This page doesn't exist.
            </p>
            <button className="action-btn primary" onClick={() => navigate('/')}>
                Back to Home
            </button>
        </div>
    );
};

export default NotFound;
