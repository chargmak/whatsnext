import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import * as userData from '../services/userData';
import '../styles/account.css';

const Settings = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { status, user, watchlist, watched, watchedEpisodes, episodeActivity, reminders, changePassword, deleteAccount } = useUser();
    const isAuthed = status === 'authed';

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState(null); // { ok, text }

    const handleExportData = () => {
        const data = {
            watchlist,
            watched,
            watchedEpisodes,
            // Per-show "last watched" stamps, so a restored backup keeps Up
            // Next in the same most-recent-first order.
            episodeActivity,
            reminders,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `whatsnext-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data || typeof data !== 'object' || Array.isArray(data)) {
                        throw new Error('Not a What\'s Next? backup');
                    }
                    const payload = {
                        watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
                        watched: Array.isArray(data.watched) ? data.watched : [],
                        episodes: data.watchedEpisodes && typeof data.watchedEpisodes === 'object' ? data.watchedEpisodes : {},
                        episodeActivity: data.episodeActivity && typeof data.episodeActivity === 'object' ? data.episodeActivity : {},
                        reminders: Array.isArray(data.reminders) ? data.reminders : [],
                    };
                    if (isAuthed) {
                        await userData.migrateLocalData(user.id, payload);
                    } else {
                        if (data.watchlist) localStorage.setItem('user_watchlist', JSON.stringify(payload.watchlist));
                        if (data.watched) localStorage.setItem('user_watched', JSON.stringify(payload.watched));
                        if (data.watchedEpisodes) localStorage.setItem('user_watched_episodes', JSON.stringify(payload.episodes));
                        if (data.episodeActivity) localStorage.setItem('user_episode_activity', JSON.stringify(payload.episodeActivity));
                        if (data.reminders) localStorage.setItem('user_reminders', JSON.stringify(payload.reminders));
                    }
                    window.location.reload();
                } catch (error) {
                    console.error('Import failed:', error);
                    alert('Error importing data. Please check the file format.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleClearData = async () => {
        if (!confirm('Are you sure you want to clear all your data? This cannot be undone!')) return;
        try {
            if (isAuthed) {
                await userData.clearAllUserData(user.id);
            } else {
                ['user_watchlist', 'user_watched', 'user_watched_episodes', 'user_episode_activity', 'user_reminders']
                    .forEach(k => localStorage.removeItem(k));
            }
            window.location.reload();
        } catch (error) {
            console.error('Clear failed:', error);
            alert('Could not clear data. Please try again.');
        }
    };

    const handleChangePassword = async () => {
        setPasswordMessage(null);
        if (newPassword.length < 6) {
            setPasswordMessage({ ok: false, text: 'Password must be at least 6 characters' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ ok: false, text: 'Passwords do not match' });
            return;
        }
        try {
            await changePassword(newPassword);
            setPasswordMessage({ ok: true, text: 'Password updated!' });
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setShowPasswordForm(false), 1200);
        } catch (error) {
            setPasswordMessage({ ok: false, text: error.message || 'Could not update password' });
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm('Delete your account? All your data (watchlist, history, reminders) will be permanently removed.')) return;
        if (!confirm('This cannot be undone. Are you absolutely sure?')) return;
        try {
            await deleteAccount();
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Account deletion failed:', error);
            alert(`Could not delete the account: ${error.message}`);
        }
    };

    const isDarkMode = theme === 'dark';

    const passwordInvalid = passwordMessage && !passwordMessage.ok ? true : undefined;

    return (
        <div className="container page page-narrow">
            {/* Header */}
            <header className="sub-header">
                <button
                    type="button"
                    className="icon-btn on-page"
                    onClick={() => navigate('/profile')}
                    aria-label="Back to profile"
                >
                    <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <h1>Settings</h1>
            </header>

            {/* Appearance */}
            <section className="account-section" aria-labelledby="settings-appearance">
                <h2 id="settings-appearance" className="section-title">Appearance</h2>
                <div className="tile account-switch-row">
                    <span>
                        <span className="account-switch-title">Dark mode</span>
                        <span className="account-row-sub">{isDarkMode ? 'Enabled' : 'Disabled'}</span>
                    </span>
                    <button
                        type="button"
                        className="switch"
                        role="switch"
                        aria-checked={isDarkMode}
                        aria-label="Dark mode"
                        onClick={toggleTheme}
                    />
                </div>
            </section>

            {/* Account */}
            <section className="account-section" aria-labelledby="settings-account">
                <h2 id="settings-account" className="section-title">Account</h2>
                {isAuthed ? (
                    <div className="list-tile">
                        <button
                            type="button"
                            className={`list-row${showPasswordForm ? ' account-expanded' : ''}`}
                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                            aria-expanded={showPasswordForm}
                            aria-controls="settings-password-form"
                        >
                            <span className="account-row-main">Change password</span>
                            <ChevronRight size={16} className="account-row-trail account-chevron" aria-hidden="true" />
                        </button>

                        {showPasswordForm && (
                            <div id="settings-password-form" className="account-password-form">
                                <input
                                    type="password"
                                    className="input-field"
                                    aria-label="New password"
                                    placeholder="New password"
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    aria-invalid={passwordInvalid}
                                    aria-describedby="settings-password-note"
                                />
                                <input
                                    type="password"
                                    className="input-field"
                                    aria-label="Confirm new password"
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    aria-invalid={passwordInvalid}
                                />
                                <span id="settings-password-note" className="field-note">
                                    Set a new password for {user.email}
                                </span>
                                {passwordMessage && (
                                    <p
                                        className={`account-form-message${passwordMessage.ok ? '' : ' is-error'}`}
                                        role={passwordMessage.ok ? 'status' : 'alert'}
                                    >
                                        {passwordMessage.ok && <Check size={14} aria-hidden="true" />}
                                        {passwordMessage.text}
                                    </p>
                                )}
                                <button type="button" className="pill-btn inverse block" onClick={handleChangePassword}>
                                    Update password
                                </button>
                            </div>
                        )}

                        <button type="button" className="list-row danger" onClick={handleDeleteAccount}>
                            <span className="account-row-main">Delete account</span>
                        </button>
                    </div>
                ) : (
                    <div className="list-tile">
                        <button type="button" className="list-row" onClick={() => navigate('/register')}>
                            <span className="account-row-main">
                                Create an Account
                                <span className="account-row-sub">
                                    Sync your watchlist across devices and never lose it
                                </span>
                            </span>
                            <ChevronRight size={16} className="account-row-trail" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </section>

            {/* Data Management */}
            <section className="account-section" aria-labelledby="settings-data">
                <h2 id="settings-data" className="section-title">Data management</h2>
                <div className="list-tile">
                    <button type="button" className="list-row" onClick={handleExportData}>
                        <span className="account-row-main">Export data</span>
                    </button>
                    <button type="button" className="list-row" onClick={handleImportData}>
                        <span className="account-row-main">Import data</span>
                    </button>
                    <button type="button" className="list-row danger" onClick={handleClearData}>
                        <span className="account-row-main">Clear all data</span>
                    </button>
                </div>
            </section>

            {/* App Info */}
            <p className="account-footer">
                What's Next? v1.0.0<br />
                Made for movie &amp; TV lovers
            </p>
        </div>
    );
};

export default Settings;
