import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const LoadingScreen = () => (
    <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>Loading...</p>
    </div>
);

// Authenticated users and guests both count as "users"; only fully
// signed-out visitors are sent to the login page.
export const RequireUser = ({ children }) => {
    const { status } = useUser();
    const location = useLocation();

    if (status === 'loading') return <LoadingScreen />;
    if (status === 'signedOut') return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    return children;
};

// Keeps authed users off /login and /register. Guests may still visit them
// to upgrade to a real account.
export const RedirectIfAuthed = ({ children }) => {
    const { status } = useUser();

    if (status === 'loading') return <LoadingScreen />;
    if (status === 'authed') return <Navigate to="/" replace />;
    return children;
};
