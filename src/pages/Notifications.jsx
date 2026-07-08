import React from 'react';
import { ArrowLeft, Bell, BellOff, Tv, Film, Calendar, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import usePersistentState from '../hooks/usePersistentState';

const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const release = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((release - today) / (1000 * 60 * 60 * 24));
};

const Notifications = () => {
    const navigate = useNavigate();
    const { user, reminders, toggleReminder } = useUser();

    const [preferences, setPreferences] = usePersistentState(
        `prefs:${user?.id || 'guest'}:notifications`,
        {
            newEpisodes: true,
            movieReleases: true,
            upcomingReleases: true,
            weeklyDigest: false,
            pushNotifications: true,
            emailNotifications: false
        }
    );

    const sortedReminders = [...reminders].sort((a, b) =>
        (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999')
    );

    const togglePreference = (key) => {
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const notificationSettings = [
        {
            id: 'newEpisodes',
            icon: <Tv size={20} />,
            title: 'New Episodes',
            description: 'Get notified when new episodes of your shows air',
            color: '#9333EA'
        },
        {
            id: 'movieReleases',
            icon: <Film size={20} />,
            title: 'Movie Releases',
            description: 'Alerts for movies in your watchlist',
            color: '#DC2626'
        },
        {
            id: 'upcomingReleases',
            icon: <Calendar size={20} />,
            title: 'Upcoming Releases',
            description: 'Reminders 1 day before release',
            color: '#FBBF24'
        },
        {
            id: 'weeklyDigest',
            icon: <Bell size={20} />,
            title: 'Weekly Digest',
            description: 'Summary of your week in entertainment',
            color: '#10B981'
        }
    ];

    const deliveryMethods = [
        {
            id: 'pushNotifications',
            title: 'Push Notifications',
            description: 'Receive notifications in the app'
        },
        {
            id: 'emailNotifications',
            title: 'Email Notifications',
            description: 'Get updates via email'
        }
    ];

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="page-header">
                <button
                    onClick={() => navigate('/profile')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        padding: '8px',
                        marginRight: '12px'
                    }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="brand-title">
                    <Bell size={28} style={{ marginRight: '8px' }} />
                    Notifications
                </h1>
            </header>

            {/* Release Reminders */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Your Reminders</h3>
                {sortedReminders.length === 0 ? (
                    <div className="glass-panel empty-state" style={{ padding: '24px', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            No reminders yet. Tap "Notify Me" on an upcoming movie to track its release here.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sortedReminders.map((reminder) => {
                            const days = daysUntil(reminder.releaseDate);
                            const released = days !== null && days <= 0;
                            return (
                                <div
                                    key={`${reminder.type}-${reminder.id}`}
                                    className="glass-panel"
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px'
                                    }}
                                >
                                    <Link to={`/${reminder.type}/${reminder.id}`} style={{ flexShrink: 0 }}>
                                        <img
                                            src={reminder.poster}
                                            alt={reminder.title}
                                            style={{ width: '48px', height: '72px', borderRadius: '8px', objectFit: 'cover' }}
                                        />
                                    </Link>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {reminder.title}
                                        </h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: released ? '#10B981' : 'var(--text-secondary)' }}>
                                            {days === null
                                                ? 'Release date unknown'
                                                : released
                                                    ? 'Released! 🎬'
                                                    : days === 1
                                                        ? 'Releases tomorrow'
                                                        : `Releases in ${days} days (${reminder.releaseDate})`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => toggleReminder(reminder)}
                                        title="Remove reminder"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            flexShrink: 0
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Notification Types */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Notification Types</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {notificationSettings.map(setting => (
                        <div
                            key={setting.id}
                            className="glass-panel"
                            style={{
                                padding: '16px',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                border: preferences[setting.id]
                                    ? `1px solid ${setting.color}40`
                                    : '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <div
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: 'var(--radius-md)',
                                    background: `${setting.color}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: setting.color,
                                    flexShrink: 0
                                }}
                            >
                                {setting.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>
                                    {setting.title}
                                </h4>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {setting.description}
                                </p>
                            </div>
                            <button
                                onClick={() => togglePreference(setting.id)}
                                style={{
                                    width: '52px',
                                    height: '28px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: preferences[setting.id]
                                        ? setting.color
                                        : 'rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    flexShrink: 0
                                }}
                            >
                                <div
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '2px',
                                        left: preferences[setting.id] ? '26px' : '2px',
                                        transition: 'all 0.3s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Delivery Methods */}
            <section>
                <h3 style={{ marginBottom: '16px' }}>Delivery Methods</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {deliveryMethods.map(method => (
                        <div
                            key={method.id}
                            className="glass-panel"
                            style={{
                                padding: '16px',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px'
                            }}
                        >
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>
                                    {method.title}
                                </h4>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {method.description}
                                </p>
                            </div>
                            <button
                                onClick={() => togglePreference(method.id)}
                                style={{
                                    width: '52px',
                                    height: '28px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: preferences[method.id]
                                        ? 'var(--brand-600)'
                                        : 'rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    flexShrink: 0
                                }}
                            >
                                <div
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '2px',
                                        left: preferences[method.id] ? '26px' : '2px',
                                        transition: 'all 0.3s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Info Note */}
            <div
                className="glass-panel"
                style={{
                    marginTop: '30px',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)'
                }}
            >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <BellOff size={20} color="#FBBF24" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Your notification preferences are saved locally. Enable push notifications in your browser settings for the best experience.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
