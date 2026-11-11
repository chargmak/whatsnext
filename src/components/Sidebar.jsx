import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Calendar, List, Layers, LogIn } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { PLACEHOLDER_POSTER } from '../services/tmdb';
import { isChromeHidden } from './chrome';

const LINKS = [
    { to: '/', label: 'Home', Icon: Home },
    { to: '/search', label: 'Browse', Icon: Search },
    { to: '/calendar', label: 'Calendar', Icon: Calendar },
    { to: '/library', label: 'Library', Icon: List },
    { to: '/franchises', label: 'Franchises', Icon: Layers },
];

// How many of the viewer's shows to keep one click away.
const SHOWS_SHOWN = 6;

/**
 * Desktop navigation: the bottom dock's destinations as a fixed left column,
 * with room for what a dock can't hold — Franchises as its own entry, the
 * shows being followed, and the account. Hidden by CSS below the desktop
 * breakpoint, where BottomNav takes over.
 */
const Sidebar = () => {
    const { pathname } = useLocation();
    const { status, user, stats, watchlist } = useUser();
    if (isChromeHidden(pathname)) return null;

    // Saved order is oldest first; show the latest saves.
    const shows = watchlist.filter((item) => item.type === 'tv').slice(-SHOWS_SHOWN).reverse();
    const signedOut = status === 'signedOut';

    return (
        <aside className="sidebar">
            <Link to="/" className="sidebar-brand">
                What&apos;s Next<span className="brand-mark">?</span>
            </Link>

            <nav className="sidebar-nav" aria-label="Main">
                {LINKS.map(({ to, label, Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <Icon size={20} aria-hidden="true" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {shows.length > 0 && (
                <div className="sidebar-group">
                    <div className="mono-label sidebar-group-label">Your shows</div>
                    {shows.map((show) => (
                        <NavLink
                            key={show.id}
                            to={`/tv/${show.id}`}
                            className={({ isActive }) => `sidebar-show ${isActive ? 'active' : ''}`}
                        >
                            <img src={show.poster || PLACEHOLDER_POSTER} alt="" loading="lazy" />
                            <span className="truncate">{show.title}</span>
                        </NavLink>
                    ))}
                </div>
            )}

            {signedOut ? (
                <Link to="/login" className="pill-btn primary sidebar-foot">
                    <LogIn size={16} aria-hidden="true" /> Log in
                </Link>
            ) : (
                <NavLink to="/profile" className={({ isActive }) => `sidebar-account sidebar-foot ${isActive ? 'active' : ''}`}>
                    {user?.avatar
                        ? <img src={user.avatar} alt="" />
                        : <span className="sidebar-initial" aria-hidden="true">{(user?.name || '?').charAt(0).toUpperCase()}</span>}
                    <span className="sidebar-account-text">
                        <span className="truncate">{user?.name || 'Profile'}</span>
                        <span className="mono-label truncate">{user?.isGuest ? 'Guest' : stats?.rank}</span>
                    </span>
                </NavLink>
            )}
        </aside>
    );
};

export default Sidebar;
