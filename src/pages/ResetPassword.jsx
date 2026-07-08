import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '../context/UserContext';
import { supabase } from '../services/supabase';

const inputStyle = (hasError) => ({
    width: '100%',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    border: hasError ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
});

const ResetPassword = () => {
    const navigate = useNavigate();
    const { status, changePassword } = useUser();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [saving, setSaving] = useState(false);

    // The recovery link signs the user into a temporary session; without one
    // (or an authed session) the link is expired or was opened directly.
    const canReset = supabase && (status === 'authed' || status === 'loading');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        setSaving(true);
        try {
            await changePassword(password);
            setDone(true);
            setTimeout(() => navigate('/', { replace: true }), 1500);
        } catch (err) {
            setError(err.message || 'Could not update password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '100px', maxWidth: '500px', margin: '0 auto' }}>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '40px' }}
            >
                <Film size={48} color="var(--brand-600)" />
                <h1 style={{ fontSize: '2rem', marginTop: '12px' }}>Set a new password</h1>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel"
                style={{ padding: '32px', borderRadius: 'var(--radius-lg)' }}
            >
                {!canReset ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            This reset link is invalid or has expired. Request a new one from the login page.
                        </p>
                        <button className="action-btn primary" onClick={() => navigate('/login')} style={{ marginTop: '16px' }}>
                            Back to Login
                        </button>
                    </div>
                ) : done ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Password updated!</p>
                        <p style={{ color: 'var(--text-secondary)' }}>Taking you to the app...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                <Lock size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                New Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="••••••••"
                                style={inputStyle(!!error)}
                            />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                <Lock size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                                placeholder="••••••••"
                                style={inputStyle(!!error)}
                            />
                            {error && (
                                <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '8px', marginBottom: 0 }}>{error}</p>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="action-btn primary"
                            disabled={saving}
                            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 600 }}
                        >
                            {saving ? 'Saving...' : 'Update Password'}
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
};

export default ResetPassword;
