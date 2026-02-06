import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Bell, BarChart2, TrendingUp, Clock, Film, UserPlus, LogIn } from 'lucide-react';
import { useUser } from '../context/UserContext';

const Profile = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const isAuthenticated = localStorage.getItem('is_authenticated') === 'true';

    const settingsItems = [
        { icon: <Bell size={20} />, label: 'Notifications', path: '/notifications' },
        { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
        { icon: <LogOut size={20} />, label: 'Log Out', color: '#EF4444', action: 'logout' }
    ];

    const handleItemClick = (item) => {
        if (item.action === 'logout') {
            if (confirm('Are you sure you want to log out?')) {
                // Clear authentication but keep watchlist data
                localStorage.removeItem('current_user');
                localStorage.removeItem('is_authenticated');
                localStorage.removeItem('user_profile');
                alert('Logged out successfully!');
                window.location.reload();
            }
        } else if (item.path) {
            navigate(item.path);
        }
    };

    // Guest user view
    if (!isAuthenticated) {
        return (
            <div className="container" style={{ paddingTop: '60px', paddingBottom: '90px' }}>
                <div style={{
                    textAlign: 'center',
                    maxWidth: '400px',
                    margin: '0 auto',
                    padding: '40px 20px'
                }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--brand-600), var(--accent-primary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px'
                    }}>
                        <Film size={48} color="white" />
                    </div>

                    <h2 style={{ marginBottom: '12px' }}>Welcome to What's Next?</h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        marginBottom: '32px',
                        fontSize: '1rem',
                        lineHeight: '1.6'
                    }}>
                        Sign in to track your favorite movies and TV shows, create watchlists, and never miss an episode!
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            onClick={() => navigate('/login')}
                            className="action-btn primary"
                            style={{
                                width: '100%',
                                padding: '14px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <LogIn size={20} />
                            Log In
                        </button>

                        <button
                            onClick={() => navigate('/register')}
                            className="action-btn secondary"
                            style={{
                                width: '100%',
                                padding: '14px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <UserPlus size={20} />
                            Create Account
                        </button>
                    </div>

                    <div className="glass-panel" style={{
                        marginTop: '32px',
                        padding: '20px',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'left'
                    }}>
                        <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '0.95rem' }}>
                            Why create an account?
                        </h4>
                        <ul style={{
                            margin: 0,
                            paddingLeft: '20px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            lineHeight: '1.8'
                        }}>
                            <li>Track your watchlist across devices</li>
                            <li>Mark episodes as watched</li>
                            <li>Get notifications for new releases</li>
                            <li>Sync your progress everywhere</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // Authenticated user view
    return (
        <div className="container" style={{ paddingTop: '20px', paddingBottom: '90px' }}>
            {/* Header */}
            <div className="flex-center" style={{ flexDirection: 'column', marginBottom: '30px' }}>
                <img
                    src={user.avatar}
                    alt="Profile"
                    className="profile-avatar"
                />
                <h2 style={{ margin: 0 }}>{user.name}</h2>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user.level}</span>

                {/* Edit Profile Button */}
                <button
                    onClick={() => navigate('/profile/edit')}
                    className="action-btn secondary"
                    style={{
                        marginTop: '16px',
                        padding: '8px 24px',
                        fontSize: '0.9rem',
                        width: 'auto'
                    }}
                >
                    Edit Profile
                </button>
            </div>

            {/* Stats Dashboard */}
            <h3 style={{ marginBottom: '16px' }}>Your Stats</h3>
            <div className="grid-layout" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '30px' }}>
                <div className="card stat-card">
                    <div className="flex-center" style={{ flexDirection: 'column', gap: '8px' }}>
                        <Clock size={24} color="var(--accent-primary)" />
                        <span className="stat-value">{user.stats.hoursWatched}h</span>
                        <p className="stat-label" style={{ margin: 0 }}>Time Watched</p>
                    </div>
                </div>
                <div className="card stat-card">
                    <div className="flex-center" style={{ flexDirection: 'column', gap: '8px' }}>
                        <Film size={24} color="#F59E0B" />
                        <span className="stat-value">{user.stats.moviesWatched}</span>
                        <p className="stat-label" style={{ margin: 0 }}>Movies</p>
                    </div>
                </div>
                <div className="card stat-card">
                    <div className="flex-center" style={{ flexDirection: 'column', gap: '8px' }}>
                        <TrendingUp size={24} color="#10B981" />
                        <span className="stat-value">{user.stats.favoriteGenre}</span>
                        <p className="stat-label" style={{ margin: 0 }}>Top Genre</p>
                    </div>
                </div>
                <div className="card stat-card">
                    <div className="flex-center" style={{ flexDirection: 'column', gap: '8px' }}>
                        <BarChart2 size={24} color="#3B82F6" />
                        <span className="stat-value">Beginner</span>
                        <p className="stat-label" style={{ margin: 0 }}>Rank</p>
                    </div>
                </div>
            </div>

            {/* Settings List */}
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {settingsItems.map((item, i) => (
                    <div
                        key={i}
                        className="settings-item"
                        onClick={() => handleItemClick(item)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="flex-center" style={{ gap: '12px', color: item.color || 'var(--text-primary)' }}>
                            {item.icon}
                            <span>{item.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            <p style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Account: {user.email || 'Dimitrios'}
            </p>
        </div>
    );
};

export default Profile;
