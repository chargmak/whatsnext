import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Bell, ChevronRight, UserPlus, LogIn, Layers } from 'lucide-react';
import { useUser } from '../context/UserContext';
import '../styles/account.css';

const Profile = () => {
    const { user, loading, logout, status, stats, reminders } = useUser();
    const navigate = useNavigate();
    const isGuest = status === 'guest';

    const handleLogout = async () => {
        const message = isGuest ? 'Exit guest mode?' : 'Are you sure you want to log out?';
        if (confirm(message)) {
            await logout();
            navigate('/login');
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="container account-loading">
                <div className="spinner"></div>
                <p>Loading profile...</p>
            </div>
        );
    }

    // Signed-out view
    if (!user) {
        return (
            <div className="container page">
                <h1 className="page-title">Profile</h1>

                <section className="tile account-welcome">
                    <h2>Welcome to What's Next?</h2>
                    <p>
                        Sign in to track your favorite movies and TV shows, create watchlists, and never miss an episode!
                    </p>
                    <div className="account-actions">
                        <button type="button" onClick={() => navigate('/login')} className="pill-btn primary lg block">
                            <LogIn size={18} aria-hidden="true" />
                            Log In
                        </button>
                        <button type="button" onClick={() => navigate('/register')} className="pill-btn ghost lg block">
                            <UserPlus size={18} aria-hidden="true" />
                            Create Account
                        </button>
                    </div>
                </section>

                <section className="tile">
                    <h3 className="section-title">Why create an account?</h3>
                    <ul className="account-benefits">
                        <li>Track your watchlist across devices</li>
                        <li>Mark episodes as watched</li>
                        <li>Get notifications for new releases</li>
                        <li>Sync your progress everywhere</li>
                    </ul>
                </section>
            </div>
        );
    }

    const reminderCount = reminders?.length || 0;
    const genre = stats.favoriteGenre;

    // Authenticated / guest user view
    return (
        <div className="container page">
            <h1 className="page-title">Profile</h1>

            {/* Guest banner */}
            {isGuest && (
                <section className="tile account-guest">
                    <p>
                        You're browsing as a guest — your data is stored on this device only.
                        Create an account to sync it everywhere.
                    </p>
                    <button type="button" onClick={() => navigate('/register')} className="pill-btn primary">
                        <UserPlus size={16} aria-hidden="true" />
                        Create Account
                    </button>
                </section>
            )}

            {/* Identity */}
            <section className="tile account-identity">
                <img src={user.avatar || undefined} alt="" className="profile-avatar" />
                <div className="account-identity-body">
                    <h2 className="account-name truncate">{user.name}</h2>
                    <span className="mono-label text-accent account-rank truncate">
                        {isGuest ? 'Guest' : stats.rank}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/profile/edit')}
                    className="pill-btn"
                    aria-label="Edit profile"
                >
                    Edit
                </button>
            </section>

            {/* Stats */}
            <section className="account-section" aria-labelledby="profile-stats-title">
                <h2 id="profile-stats-title" className="section-title">Your stats</h2>
                <div className="bento">
                    <div className="stat-card">
                        <span className="stat-label">Time watched</span>
                        <span className="stat-value account-stat-accent">
                            {stats.hoursWatched.toLocaleString()}
                            <span className="account-stat-unit"> h</span>
                        </span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Movies</span>
                        <span className="stat-value">{stats.moviesWatched.toLocaleString()}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Top genre</span>
                        <span className={`stat-value account-stat-text${genre.length > 8 ? ' is-long' : ''}`}>
                            {genre}
                        </span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Episodes</span>
                        <span className="stat-value">{stats.episodesWatched.toLocaleString()}</span>
                    </div>
                </div>
            </section>

            {/* Menu */}
            <nav className="list-tile" aria-label="Account">
                <button type="button" className="list-row" onClick={() => navigate('/notifications')}>
                    <Bell size={20} className="account-row-icon" aria-hidden="true" />
                    <span className="account-row-main">Notifications</span>
                    {reminderCount > 0 ? (
                        <span className="mono-label account-row-trail">
                            {reminderCount} {reminderCount === 1 ? 'reminder' : 'reminders'}
                        </span>
                    ) : (
                        <ChevronRight size={16} className="account-row-trail" aria-hidden="true" />
                    )}
                </button>
                <button type="button" className="list-row" onClick={() => navigate('/franchises')}>
                    <Layers size={20} className="account-row-icon" aria-hidden="true" />
                    <span className="account-row-main">Franchises</span>
                    <ChevronRight size={16} className="account-row-trail" aria-hidden="true" />
                </button>
                <button type="button" className="list-row" onClick={() => navigate('/settings')}>
                    <Settings size={20} className="account-row-icon" aria-hidden="true" />
                    <span className="account-row-main">Settings</span>
                    <ChevronRight size={16} className="account-row-trail" aria-hidden="true" />
                </button>
                <button type="button" className="list-row danger" onClick={handleLogout}>
                    <LogOut size={20} className="account-row-icon" aria-hidden="true" />
                    <span className="account-row-main">{isGuest ? 'Exit Guest Mode' : 'Log out'}</span>
                </button>
            </nav>

            <p className="account-footer">
                {isGuest ? 'Guest session' : `Account: ${user.email}`}
            </p>
        </div>
    );
};

export default Profile;
