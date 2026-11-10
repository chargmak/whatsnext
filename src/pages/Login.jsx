import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { supabase } from '../services/supabase';
import '../styles/auth.css';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [resetNotice, setResetNotice] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        return newErrors;
    };

    const { login, enterGuestMode } = useUser();

    const handleLogin = async (e) => {
        e.preventDefault();

        const newErrors = validateForm();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setSubmitting(true);
        try {
            await login(formData.email, formData.password);
            navigate(location.state?.from || '/', { replace: true });
        } catch (err) {
            setErrors({ password: err.message || 'Invalid email or password' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        setResetNotice('');
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            setErrors({ email: 'Enter your email above first, then tap "Forgot password?"' });
            return;
        }
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setResetNotice('Password reset email sent — check your inbox.');
        } catch (err) {
            setErrors({ email: err.message || 'Could not send reset email' });
        }
    };

    const handleGuest = () => {
        enterGuestMode();
        navigate('/', { replace: true });
    };

    return (
        <div className="container page auth-page">
            <header>
                <div className="brand-title">What's Next<span className="brand-mark">?</span></div>
                <p className="auth-tagline">Track your favorite movies &amp; TV shows</p>
            </header>

            {/* Login form */}
            <section className="tile auth-card">
                <h1 className="auth-heading">Welcome back</h1>

                <form className="auth-form" onSubmit={handleLogin}>
                    {/* Email */}
                    <div className="field">
                        <label className="field-label" htmlFor="login-email">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="you@example.com"
                            autoComplete="email"
                            className="input-field"
                            aria-invalid={errors.email ? true : undefined}
                            aria-describedby={errors.email ? 'login-email-error' : undefined}
                        />
                        {errors.email && (
                            <span id="login-email-error" className="field-error" role="alert">
                                {errors.email}
                            </span>
                        )}
                    </div>

                    {/* Password */}
                    <div className="field">
                        <label className="field-label" htmlFor="login-password">Password</label>
                        <div className="auth-password">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="Your password"
                                autoComplete="current-password"
                                className="input-field"
                                aria-invalid={errors.password ? true : undefined}
                                aria-describedby={errors.password ? 'login-password-error' : undefined}
                            />
                            <button
                                type="button"
                                className="icon-btn bare"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                            </button>
                        </div>
                        {errors.password && (
                            <span id="login-password-error" className="field-error" role="alert">
                                {errors.password}
                            </span>
                        )}
                    </div>

                    {supabase && (
                        <button type="button" className="link-accent auth-forgot" onClick={handleForgotPassword}>
                            Forgot password?
                        </button>
                    )}
                    {resetNotice && (
                        <p className="auth-success" role="status">
                            <Check size={16} aria-hidden="true" />
                            {resetNotice}
                        </p>
                    )}

                    {!supabase && (
                        <p className="auth-notice">
                            Accounts are unavailable in this deployment. You can still use the app as a guest below.
                        </p>
                    )}

                    <button
                        type="submit"
                        className="pill-btn primary lg block"
                        disabled={submitting || !supabase}
                    >
                        {submitting ? 'Logging in...' : 'Log in'}
                    </button>
                </form>
            </section>

            <Link to="/register" className="auth-switch">
                Don't have an account? <strong>Sign up</strong>
            </Link>

            <hr className="auth-divider" />

            <button type="button" onClick={handleGuest} className="pill-btn ghost lg block">
                Continue as guest
            </button>
            <p className="auth-note">
                Guest data stays on this device. You can import it into an account later.
            </p>
        </div>
    );
};

export default Login;
