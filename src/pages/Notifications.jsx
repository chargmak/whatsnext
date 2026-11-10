import React, { useState, useEffect, useCallback } from 'react';
import { BellOff, ChevronLeft, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import usePersistentState from '../hooks/usePersistentState';
import {
    pushSupported,
    pushConfigured,
    getPermission,
    isSubscribed,
    isRegisteredOnServer,
    subscribeToPush,
    unsubscribeFromPush,
    syncPushSubscription,
} from '../services/push';
import { startOfZonedDay, todayKey } from '../services/releaseTime';
import '../styles/notifications.css';

// Whole days from today to a release date, both read in the viewer's zone — a
// reminder must not flip to "Released" while it's still yesterday where they are.
const daysUntil = (dateStr, zone) => {
    if (!dateStr) return null;
    const start = startOfZonedDay(dateStr, zone);
    const todayStart = startOfZonedDay(todayKey(zone), zone);
    if (!start || !todayStart) return null;
    return Math.round((start - todayStart) / 86400000);
};

const Notifications = () => {
    const { status, user, reminders, toggleReminder, timeZone } = useUser();

    // Guest ids ("guest-12345") are local-only and never key a server row, so
    // anything that talks to push_subscriptions has to see null for them.
    const accountId = status === 'authed' ? user?.id : null;

    const [push, setPush] = useState({
        supported: true,
        subscribed: false,
        // Whether the server actually holds this device's subscription. The
        // browser saying "subscribed" isn't enough — that's the state alerts
        // die in, and it's what this page has to be honest about.
        registered: true,
        permission: 'default',
        busy: false,
        error: null,
    });

    useEffect(() => {
        let active = true;
        (async () => {
            if (!pushSupported()) {
                if (active) setPush((p) => ({ ...p, supported: false }));
                return;
            }
            // Someone opening this page is often here because alerts stopped —
            // repair a retired subscription before reporting on it.
            if (accountId) await syncPushSubscription(accountId);
            const subscribed = await isSubscribed();
            const registered = await isRegisteredOnServer(accountId);
            if (active) {
                setPush((p) => ({ ...p, subscribed, registered, permission: getPermission() }));
            }
        })();
        return () => {
            active = false;
        };
    }, [accountId]);

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

    const handlePushToggle = useCallback(async () => {
        setPush((p) => ({ ...p, busy: true, error: null }));
        try {
            if (push.subscribed) {
                await unsubscribeFromPush(accountId);
                setPush((p) => ({ ...p, subscribed: false, registered: false, busy: false, permission: getPermission() }));
                setPreferences((prev) => ({ ...prev, pushNotifications: false }));
            } else {
                await subscribeToPush(accountId);
                const registered = await isRegisteredOnServer(accountId);
                setPush((p) => ({ ...p, subscribed: true, registered, busy: false, permission: getPermission() }));
                setPreferences((prev) => ({ ...prev, pushNotifications: true }));
            }
        } catch (err) {
            setPush((p) => ({ ...p, busy: false, error: err.message, permission: getPermission() }));
        }
    }, [push.subscribed, accountId, setPreferences]);

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
            title: 'New episodes',
            description: 'Get notified when new episodes of your shows air'
        },
        {
            id: 'movieReleases',
            title: 'Movie releases',
            description: 'Alerts for movies in your watchlist'
        },
        {
            id: 'upcomingReleases',
            title: 'Upcoming releases',
            description: 'Reminders 1 day before release'
        },
        {
            id: 'weeklyDigest',
            title: 'Weekly digest',
            description: 'Summary of your week in entertainment'
        }
    ];

    const deliveryMethods = [
        {
            id: 'pushNotifications',
            title: 'Push notifications',
            description: 'Receive notifications in the app'
        },
        {
            id: 'emailNotifications',
            title: 'Email notifications',
            description: 'Get updates via email'
        }
    ];

    return (
        <div className="container page">
            <header className="sub-header">
                <Link to="/profile" className="icon-btn on-page" aria-label="Back to profile">
                    <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
                </Link>
                <h1>Notifications</h1>
            </header>

            {/* Release Reminders */}
            <section className="notif-section">
                <h2 className="section-title">Your reminders</h2>
                {sortedReminders.length === 0 ? (
                    <div className="empty-state notif-empty">
                        <p>
                            No reminders yet. Tap "Notify Me" on an upcoming movie to track its release here.
                        </p>
                    </div>
                ) : (
                    <ul className="list-tile notif-list">
                        {sortedReminders.map((reminder) => {
                            const days = daysUntil(reminder.releaseDate, timeZone);
                            const released = days !== null && days <= 0;
                            const statusClass = days === null
                                ? ' is-unknown'
                                : released ? ' is-released' : '';
                            return (
                                <li
                                    key={`${reminder.type}-${reminder.id}`}
                                    className="list-row static notif-reminder"
                                >
                                    <Link
                                        to={`/${reminder.type}/${reminder.id}`}
                                        className="notif-poster-link"
                                    >
                                        <img
                                            className="notif-poster"
                                            src={reminder.poster}
                                            alt={reminder.title}
                                        />
                                    </Link>
                                    <div className="notif-body">
                                        <div className="notif-title truncate">{reminder.title}</div>
                                        <div className={`notif-status${statusClass}`}>
                                            {days === null
                                                ? 'Release date unknown'
                                                : released
                                                    ? days === 0 ? 'Out today' : 'Released!'
                                                    : days === 1
                                                        ? 'Releases tomorrow'
                                                        : `Releases in ${days} days (${reminder.releaseDate})`}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={() => toggleReminder(reminder)}
                                        aria-label={`Remove reminder for ${reminder.title}`}
                                    >
                                        <X size={16} strokeWidth={2.5} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* Notification Types */}
            <section className="notif-section">
                <h2 className="section-title">Notification types</h2>
                <div className="list-tile">
                    {notificationSettings.map((setting) => (
                        <div key={setting.id} className="list-row static">
                            <span className="notif-body">
                                <span className="notif-label">{setting.title}</span>
                                <span className="notif-sub" id={`notif-desc-${setting.id}`}>
                                    {setting.description}
                                </span>
                            </span>
                            <button
                                type="button"
                                role="switch"
                                className="switch"
                                aria-checked={Boolean(preferences[setting.id])}
                                aria-label={setting.title}
                                aria-describedby={`notif-desc-${setting.id}`}
                                onClick={() => togglePreference(setting.id)}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Delivery Methods */}
            <section className="notif-section">
                <h2 className="section-title">Delivery</h2>
                <div className="list-tile">
                    {deliveryMethods.map((method) => {
                        const isPush = method.id === 'pushNotifications';

                        // The push toggle reflects the real browser subscription;
                        // email is still a saved-preference placeholder.
                        const isOn = isPush ? push.subscribed : preferences[method.id];
                        const disabled = isPush && (push.busy || !push.supported || !pushConfigured());
                        const onToggle = isPush ? handlePushToggle : () => togglePreference(method.id);

                        // The subscription registered for this account on this
                        // device — the thing scheduled alerts are actually sent
                        // to. Only meaningful once signed in; guests have none.
                        const pushBroken = isPush && push.subscribed && !push.registered
                            && status === 'authed';

                        let description = method.description;
                        if (isPush) {
                            if (!push.supported) description = 'Not supported on this device or browser';
                            else if (!pushConfigured()) description = 'Not enabled for this deployment yet';
                            else if (push.permission === 'denied') description = 'Blocked — enable notifications for this site in your browser settings';
                            else if (push.busy) description = 'Working…';
                            else if (pushBroken) description = 'This device needs re-registering';
                            else if (push.subscribed && status === 'authed') description = 'On — alerts are registered for this device';
                        }

                        return (
                            <div key={method.id} className="list-row static notif-delivery">
                                <div className="notif-body">
                                    <span className="notif-label">{method.title}</span>
                                    <span className="notif-sub" id={`notif-desc-${method.id}`}>
                                        {description}
                                    </span>
                                    {isPush && push.error && (
                                        <span className="notif-warning" role="alert">
                                            {push.error}
                                        </span>
                                    )}
                                    {pushBroken && (
                                        <span className="notif-warning">
                                            Your browser dropped its subscription, so alerts stopped arriving.
                                            Turn this off and on again to restore them.
                                        </span>
                                    )}
                                    {isPush && push.subscribed && status !== 'authed' && (
                                        <span className="notif-warning">
                                            Sign in to receive scheduled release alerts — guest reminders are tracked on this device only.
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    className="switch"
                                    aria-checked={Boolean(isOn)}
                                    aria-label={method.title}
                                    aria-describedby={`notif-desc-${method.id}`}
                                    aria-busy={isPush && push.busy ? true : undefined}
                                    onClick={onToggle}
                                    disabled={disabled}
                                />
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Info Note */}
            <div className="notif-note">
                <BellOff size={18} aria-hidden="true" />
                <p>
                    Turn on Push Notifications to get alerted when a title you tapped "Notify Me" on is released. You'll be asked to allow notifications, and alerts are sent even when the app is closed. Install the app to your home screen for the most reliable delivery.
                </p>
            </div>
        </div>
    );
};

export default Notifications;
