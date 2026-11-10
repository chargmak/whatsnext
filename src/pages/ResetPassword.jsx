import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { supabase } from '../services/supabase';
import '../styles/auth.css';

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
        <div className="container page auth-page">
            <div className="brand-title">What's Next<span className="brand-mark">?</span></div>

            <section className="tile auth-card">
                <h1 className="auth-heading">Set a new password</h1>

                {!canReset ? (
                    <>
                        <p className="auth-state-text">
                            This reset link is invalid or has expired. Request a new one from the login page.
                        </p>
                        <button
                            type="button"
                            className="pill-btn primary lg block auth-submit"
                            onClick={() => navigate('/login')}
                        >
                            Back to Login
                        </button>
                    </>
                ) : done ? (
                    <div role="status">
                        <p className="auth-success">
                            <Check size={16} aria-hidden="true" />
                            <span className="auth-state-title">Password updated!</span>
                        </p>
                        <p className="auth-state-text">Taking you to the app...</p>
                    </div>
                ) : (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="field">
                            <label className="field-label" htmlFor="reset-password">New password</label>
                            <input
                                id="reset-password"
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="At least 6 characters"
                                autoComplete="new-password"
                                className="input-field"
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? 'reset-error' : undefined}
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="reset-confirm">Confirm password</label>
                            <input
                                id="reset-confirm"
                                type="password"
                                value={confirm}
                                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                                placeholder="Repeat your password"
                                autoComplete="new-password"
                                className="input-field"
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? 'reset-error' : undefined}
                            />
                            {error && (
                                <span id="reset-error" className="field-error" role="alert">{error}</span>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="pill-btn primary lg block auth-submit"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Update password'}
                        </button>
                    </form>
                )}
            </section>

            {canReset && !done && (
                <Link to="/login" className="auth-switch is-plain">
                    Back to login
                </Link>
            )}
        </div>
    );
};

export default ResetPassword;
