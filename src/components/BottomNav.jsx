import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Calendar, List, User } from 'lucide-react';

// Sign-in screens are a dead end for the tabs (every one of them would bounce
// straight back to login), so the dock stays out of the way there.
const HIDDEN_ON = ['/login', '/register', '/reset-password'];

const TABS = [
    { to: '/', label: 'Home', Icon: Home },
    { to: '/search', label: 'Search', Icon: Search },
    { to: '/calendar', label: 'Calendar', Icon: Calendar },
    { to: '/library', label: 'Library', Icon: List },
    { to: '/profile', label: 'Profile', Icon: User },
];

const BottomNav = () => {
    const { pathname } = useLocation();
    if (HIDDEN_ON.includes(pathname)) return null;

    return (
        <nav className="bottom-nav" aria-label="Main">
            {TABS.map(({ to, label, Icon }) => (
                <NavLink
                    key={to}
                    to={to}
                    aria-label={label}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                </NavLink>
            ))}
        </nav>
    );
};

export default BottomNav;
