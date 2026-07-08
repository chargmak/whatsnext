import React, { useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Download, Trash2, KeyRound, UserX, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import * as userData from '../services/userData';

const panelButtonStyle = (danger = false) => ({
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    border: danger ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.05)',
    background: danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.02)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: danger ? '#EF4444' : 'var(--text-primary)',
    transition: 'all 0.2s',
    width: '100%'
});

const Settings = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { status, user, watchlist, watched, watchedEpisodes, changePassword, deleteAccount } = useUser();
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
                    const payload = {
                        watchlist: data.watchlist || [],
                        watched: data.watched || [],
                        episodes: data.watchedEpisodes || {},
                    };
                    if (isAuthed) {
                        await userData.migrateLocalData(user.id, payload);
                    } else {
                        if (data.watchlist) localStorage.setItem('user_watchlist', JSON.stringify(data.watchlist));
                        if (data.watched) localStorage.setItem('user_watched', JSON.stringify(data.watched));
                        if (data.watchedEpisodes) localStorage.setItem('user_watched_episodes', JSON.stringify(data.watchedEpisodes));
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
                ['user_watchlist', 'user_watched', 'user_watched_episodes', 'user_reminders'].forEach(k => localStorage.removeItem(k));
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

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        outline: 'none',
        marginBottom: '12px'
    };

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
                    <SettingsIcon size={28} style={{ marginRight: '8px' }} />
                    Settings
                </h1>
            </header>

            {/* Appearance */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Appearance</h3>
                <div className="glass-panel" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div
                        className="settings-item"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                            <div>
                                <div style={{ fontWeight: '500' }}>Dark Mode</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {isDarkMode ? 'Enabled' : 'Disabled'}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            style={{
                                width: '52px',
                                height: '28px',
                                borderRadius: '14px',
                                border: 'none',
                                background: isDarkMode ? 'var(--brand-600)' : 'rgba(255,255,255,0.1)',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
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
                                    left: isDarkMode ? '26px' : '2px',
                                    transition: 'all 0.3s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* Account */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Account</h3>
                {isAuthed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="glass-panel" style={panelButtonStyle()}>
                            <KeyRound size={20} color="#3B82F6" />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: '500' }}>Change Password</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Set a new password for {user.email}
                                </div>
                            </div>
                        </button>

                        {showPasswordForm && (
                            <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                <input
                                    type="password"
                                    placeholder="New password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    style={inputStyle}
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={inputStyle}
                                />
                                {passwordMessage && (
                                    <p style={{
                                        color: passwordMessage.ok ? '#10B981' : '#EF4444',
                                        fontSize: '0.85rem',
                                        margin: '0 0 12px'
                                    }}>
                                        {passwordMessage.text}
                                    </p>
                                )}
                                <button className="action-btn primary" style={{ width: '100%', padding: '12px' }} onClick={handleChangePassword}>
                                    Update Password
                                </button>
                            </div>
                        )}

                        <button onClick={handleDeleteAccount} className="glass-panel" style={panelButtonStyle(true)}>
                            <UserX size={20} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: '500' }}>Delete Account</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    Permanently remove your account and all data
                                </div>
                            </div>
                        </button>
                    </div>
                ) : (
                    <button onClick={() => navigate('/register')} className="glass-panel" style={panelButtonStyle()}>
                        <UserPlus size={20} color="#10B981" />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: '500' }}>Create an Account</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Sync your watchlist across devices and never lose it
                            </div>
                        </div>
                    </button>
                )}
            </section>

            {/* Data Management */}
            <section>
                <h3 style={{ marginBottom: '16px' }}>Data Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={handleExportData} className="glass-panel" style={panelButtonStyle()}>
                        <Download size={20} color="#10B981" />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: '500' }}>Export Data</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Download your watchlist and progress
                            </div>
                        </div>
                    </button>

                    <button onClick={handleImportData} className="glass-panel" style={panelButtonStyle()}>
                        <Download size={20} color="#3B82F6" style={{ transform: 'rotate(180deg)' }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: '500' }}>Import Data</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Restore from a backup file
                            </div>
                        </div>
                    </button>

                    <button onClick={handleClearData} className="glass-panel" style={panelButtonStyle(true)}>
                        <Trash2 size={20} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: '500' }}>Clear All Data</div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                Delete all watchlist and progress data
                            </div>
                        </div>
                    </button>
                </div>
            </section>

            {/* App Info */}
            <div
                className="glass-panel"
                style={{
                    marginTop: '30px',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center'
                }}
            >
                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    What's Next? v1.0.0
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    Made with ❤️ for movie & TV lovers
                </p>
            </div>
        </div>
    );
};

export default Settings;
