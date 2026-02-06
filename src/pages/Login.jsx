import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '../context/UserContext';

const Login = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState({});

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

    const { login } = useUser();

    // ... (rest of state initialization) ...

    const handleLogin = async (e) => {
        e.preventDefault();

        const newErrors = validateForm();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            await login(formData.email, formData.password);

            // If we get here, login was successful
            // Wait a brief moment for state to sync if needed, though context handles it
            window.location.href = '/';
        } catch (err) {
            console.error(err);
            // Fallback: check local storage for demo users if Supabase fails/not configured
            const users = JSON.parse(localStorage.getItem('app_users') || '[]');
            const user = users.find(u => u.email === formData.email && u.password === formData.password);

            if (user) {
                localStorage.setItem('current_user', JSON.stringify(user));
                localStorage.setItem('is_authenticated', 'true');
                localStorage.setItem('user_profile', JSON.stringify({
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    bio: user.bio || 'Movie and TV enthusiast',
                    joinDate: user.joinDate
                }));
                alert('Login successful (Local)!');
                window.location.href = '/';
            } else {
                setErrors({ password: err.message || 'Invalid email or password' });
            }
        }
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
                    </div>

                    {/* Login Button */}
                    <button
                        type="submit"
                        className="action-btn primary"
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '1rem',
                            fontWeight: '600',

                        }}
                    >
                        Log In
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
            </motion.div>
        </div>
    );
};

export default Login;
