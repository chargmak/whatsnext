import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Mail, Lock, User, Eye, EyeOff, Globe, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '../context/UserContext';

// Countries for streaming services (sorted alphabetically)
const COUNTRIES = [
    { code: 'AR', name: 'Argentina' },
    { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'BR', name: 'Brazil' },
    { code: 'CA', name: 'Canada' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'DK', name: 'Denmark' },
    { code: 'EG', name: 'Egypt' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'GR', name: 'Greece' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'HU', name: 'Hungary' },
    { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'MX', name: 'Mexico' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'NO', name: 'Norway' },
    { code: 'PH', name: 'Philippines' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russia' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'ES', name: 'Spain' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TH', name: 'Thailand' },
    { code: 'TR', name: 'Turkey' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
    { code: 'VN', name: 'Vietnam' }
];


const Register = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        country: ''
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

        if (!formData.name) {
            newErrors.name = 'Name is required';
        } else if (formData.name.length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.country) {
            newErrors.country = 'Please select your country';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        return newErrors;
    };

    const { signup } = useUser();
    const [submitting, setSubmitting] = useState(false);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();

        const newErrors = validateForm();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setSubmitting(true);
        try {
            const result = await signup(formData.email, formData.password, {
                full_name: formData.name,
                country: formData.country,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name)}`,
                bio: 'Movie and TV enthusiast',
            });

            if (result?.needsConfirmation) {
                setNeedsConfirmation(true);
                return;
            }
            navigate('/', { replace: true });
        } catch (err) {
            const message = err.message || 'Could not create the account';
            if (/already registered/i.test(message)) {
                setErrors({ email: message });
            } else {
                setErrors({ confirmPassword: message });
            }
        } finally {
            setSubmitting(false);
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
                    Start tracking your entertainment journey
                </p>
            </motion.div>

            {/* Register Form */}
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
                    Create Account
                </h2>

                {needsConfirmation ? (
                    <div style={{ textAlign: 'center' }}>
                        <Mail size={40} color="var(--brand-600)" style={{ marginBottom: '12px' }} />
                        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                            Almost there!
                        </p>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            We sent a confirmation link to <strong>{formData.email}</strong>.
                            Confirm your email, then log in.
                        </p>
                        <button className="action-btn primary" onClick={() => navigate('/login')}>
                            Go to Login
                        </button>
                    </div>
                ) : (
                <form onSubmit={handleRegister}>
                    {/* Name */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <User size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Full Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="John Doe"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: errors.name ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => !errors.name && (e.target.style.border = '1px solid var(--brand-600)')}
                            onBlur={(e) => !errors.name && (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                        />
                        {errors.name && (
                            <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
                                {errors.name}
                            </p>
                        )}
                    </div>

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

                    {/* Country */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <Globe size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Country
                        </label>
                        <select
                            name="country"
                            value={formData.country}
                            onChange={handleInputChange}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: errors.country ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: formData.country ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }}
                            onFocus={(e) => !errors.country && (e.target.style.border = '1px solid var(--brand-600)')}
                            onBlur={(e) => !errors.country && (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                        >
                            <option value="" disabled>Select your country</option>
                            {COUNTRIES.map(country => (
                                <option key={country.code} value={country.code} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                        {errors.country && (
                            <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
                                {errors.country}
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '20px' }}>
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

                    {/* Confirm Password */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <Lock size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Confirm Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '12px 48px 12px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    border: errors.confirmPassword ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => !errors.confirmPassword && (e.target.style.border = '1px solid var(--brand-600)')}
                                onBlur={(e) => !errors.confirmPassword && (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {errors.confirmPassword && (
                            <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
                                {errors.confirmPassword}
                            </p>
                        )}
                    </div>

                    {/* Register Button */}
                    <button
                        type="submit"
                        className="action-btn primary"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '1rem',
                            fontWeight: '600'
                        }}
                    >
                        {submitting ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                )}
            </motion.div>

            {/* Login Link */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ textAlign: 'center' }}
            >
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Already have an account?{' '}
                    <button
                        onClick={() => navigate('/login')}
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
                        Log In
                    </button>
                </p>
            </motion.div>
        </div>
    );
};

export default Register;
