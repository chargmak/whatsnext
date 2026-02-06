import React, { useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Globe, Download, Trash2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const Settings = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const [settings, setSettings] = useState({
        autoPlay: true,
        hdQuality: true,
        dataSync: true,
        analytics: false
    });

    const toggleSetting = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleExportData = () => {
        const data = {
            watchlist: JSON.parse(localStorage.getItem('user_watchlist') || '[]'),
            watched: JSON.parse(localStorage.getItem('user_watched') || '[]'),
            watchedEpisodes: JSON.parse(localStorage.getItem('user_watched_episodes') || '{}'),
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
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (data.watchlist) localStorage.setItem('user_watchlist', JSON.stringify(data.watchlist));
                        if (data.watched) localStorage.setItem('user_watched', JSON.stringify(data.watched));
                        if (data.watchedEpisodes) localStorage.setItem('user_watched_episodes', JSON.stringify(data.watchedEpisodes));
                        alert('Data imported successfully! Refresh the page to see changes.');
                    } catch (error) {
                        alert('Error importing data. Please check the file format.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleClearData = () => {
        if (confirm('Are you sure you want to clear all your data? This cannot be undone!')) {
            localStorage.removeItem('user_watchlist');
            localStorage.removeItem('user_watched');
            localStorage.removeItem('user_watched_episodes');
            alert('All data cleared! Refresh the page.');
        }
    };

    const isDarkMode = theme === 'dark';

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

            {/* Playback */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Playback</h3>
                <div className="glass-panel" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {[
                        { key: 'autoPlay', label: 'Auto-play Trailers', desc: 'Automatically play trailers when available' },
                        { key: 'hdQuality', label: 'HD Quality', desc: 'Prefer high-definition content' }
                    ].map((item, idx) => (
                        <div
                            key={item.key}
                            className="settings-item"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: idx === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: '500' }}>{item.label}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {item.desc}
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting(item.key)}
                                style={{
                                    width: '52px',
                                    height: '28px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: settings[item.key] ? 'var(--brand-600)' : 'rgba(255,255,255,0.1)',
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
                                        left: settings[item.key] ? '26px' : '2px',
                                        transition: 'all 0.3s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Data & Privacy */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Data & Privacy</h3>
                <div className="glass-panel" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {[
                        { key: 'dataSync', label: 'Cloud Sync', desc: 'Sync data across devices', icon: <Globe size={20} /> },
                        { key: 'analytics', label: 'Analytics', desc: 'Help improve the app', icon: <Shield size={20} /> }
                    ].map((item, idx) => (
                        <div
                            key={item.key}
                            className="settings-item"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: idx === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {item.icon}
                                <div>
                                    <div style={{ fontWeight: '500' }}>{item.label}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {item.desc}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting(item.key)}
                                style={{
                                    width: '52px',
                                    height: '28px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: settings[item.key] ? 'var(--brand-600)' : 'rgba(255,255,255,0.1)',
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
                                        left: settings[item.key] ? '26px' : '2px',
                                        transition: 'all 0.3s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Data Management */}
            <section>
                <h3 style={{ marginBottom: '16px' }}>Data Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleExportData}
                        className="glass-panel"
                        style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            background: 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: 'var(--text-primary)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                        <Download size={20} color="#10B981" />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: '500' }}>Export Data</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Download your watchlist and progress
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleImportData}
                        className="glass-panel"
                        style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            background: 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: 'var(--text-primary)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                        <Download size={20} color="#3B82F6" style={{ transform: 'rotate(180deg)' }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: '500' }}>Import Data</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Restore from a backup file
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleClearData}
                        className="glass-panel"
                        style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: '#EF4444',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    >
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
