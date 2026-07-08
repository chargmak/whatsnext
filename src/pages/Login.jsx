import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Film, Mail, Lock, Eye, EyeOff, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '../context/UserContext';
import { supabase } from '../services/supabase';

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
        <div className="container" style={{
            paddingTop: '40px',
            paddingBottom: '100px',
            maxWidth: '500px',
            margin: '0 auto'
        }}>
            {/* Logo/Brand */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '40px' }}
            >
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                }}>
                    <Film size={48} color="var(--brand-600)" />
                    <h1 style={{
                        fontSize: '2.5rem',
                        margin: 0,
                        background: 'linear-gradient(135deg, var(--brand-600), var(--accent-primary))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        What's Next?
                    </h1>
                </div>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '1.1rem',
                    margin: 0
                }}>
                    Track your favorite movies & TV shows
                </p>
            </motion.div>

            {/* Login Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel"
                style={{
                    padding: '32px',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '20px'
                }}
            >
                <h2 style={{ marginTop: 0, marginBottom: '24px', textAlign: 'center' }}>
                    Welcome Back
                </h2>

                <form onSubmit={handleLogin}>
                    {/* Email */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <Mail size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="your@email.com"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: errors.email ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => !errors.email && (e.target.style.border = '1px solid var(--brand-600)')}
                            onBlur={(e) => !errors.email && (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                        />
                        {errors.email && (
                            <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
                                {errors.email}
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <Lock size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '12px 48px 12px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    border: errors.password ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => !errors.password && (e.target.style.border = '1px solid var(--brand-600)')}
                                onBlur={(e) => !errors.password && (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    padding: '4px'
                                }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {errors.password && (
                            <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
                                {errors.password}
                            </p>
                        )}
                        {supabase && (
                            <div style={{ textAlign: 'right', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        textDecoration: 'underline',
                                        padding: 0
                                    }}
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}
                        {resetNotice && (
                            <p style={{ color: '#10B981', fontSize: '0.85rem', marginTop: '8px', marginBottom: 0 }}>
                                {resetNotice}
                            </p>
                        )}
                    </div>

                    {!supabase && (
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '16px'
                        }}>
                            Accounts are unavailable in this deployment. You can still use the app as a guest below.
                        </p>
                    )}

                    {/* Login Button */}
                    <button
                        type="submit"
                        className="action-btn primary"
                        disabled={submitting || !supabase}
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            opacity: !supabase ? 0.5 : 1
                        }}
                    >
                        {submitting ? 'Logging in...' : 'Log In'}
                    </button>


                </form>
            </motion.div>

            {/* Register Link */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ textAlign: 'center' }}
            >
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Don't have an account?{' '}
                    <button
                        onClick={() => navigate('/register')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--brand-600)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem',
                            textDecoration: 'underline'
                        }}
                    >
                        Sign Up
                    </button>
                </p>

                <button
                    onClick={handleGuest}
                    className="action-btn"
                    style={{
                        marginTop: '20px',
                        padding: '12px 24px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <UserCircle size={20} />
                    Continue as guest
                </button>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8px' }}>
                    Guest data stays on this device. You can create an account later to sync it.
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
