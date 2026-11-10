import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Eye, EyeOff, ChevronDown, X } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { deviceTimeZone } from '../services/releaseTime';
import { COUNTRIES } from '../data/countries';
import '../styles/auth.css';

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
                // Detected, not asked: release times need the viewer's real
                // clock, and the push jobs have no device to read it from.
                timezone: deviceTimeZone(),
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
        <div className="container page auth-page is-long">
            {/* The dock is hidden on these screens, so this is the way back to
                the public pages for someone who doesn't want to sign in yet. */}
            <header className="auth-header">
                <div>
                    <div className="brand-title">What's Next<span className="brand-mark">?</span></div>
                    <p className="auth-tagline">Start tracking your entertainment journey</p>
                </div>
                <Link to="/" className="icon-btn on-page" aria-label="Close and keep browsing">
                    <X size={18} strokeWidth={2.5} aria-hidden="true" />
                </Link>
            </header>

            {/* Register form */}
            <section className="tile auth-card">
                <h1 className="auth-heading">Create account</h1>

                {needsConfirmation ? (
                    <>
                        <Mail size={32} className="auth-state-icon" aria-hidden="true" />
                        <p className="auth-state-title" role="status">Almost there!</p>
                        <p className="auth-state-text">
                            We sent a confirmation link to <strong>{formData.email}</strong>.
                            Confirm your email, then log in.
                        </p>
                        <button
                            type="button"
                            className="pill-btn primary lg block auth-submit"
                            onClick={() => navigate('/login')}
                        >
                            Go to Login
                        </button>
                    </>
                ) : (
                    <form className="auth-form" onSubmit={handleRegister}>
                        <div className="field">
                            <label className="field-label" htmlFor="register-name">Full name</label>
                            <input
                                id="register-name"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="Your name"
                                autoComplete="name"
                                className="input-field"
                                aria-invalid={errors.name ? true : undefined}
                                aria-describedby={errors.name ? 'register-name-error' : undefined}
                            />
                            {errors.name && (
                                <span id="register-name-error" className="field-error" role="alert">
                                    {errors.name}
                                </span>
                            )}
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="register-email">Email</label>
                            <input
                                id="register-email"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="you@example.com"
                                autoComplete="email"
                                className="input-field"
                                aria-invalid={errors.email ? true : undefined}
                                aria-describedby={errors.email ? 'register-email-error' : undefined}
                            />
                            {errors.email && (
                                <span id="register-email-error" className="field-error" role="alert">
                                    {errors.email}
                                </span>
                            )}
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="register-country">Country</label>
                            <div className="auth-select">
                                <select
                                    id="register-country"
                                    name="country"
                                    value={formData.country}
                                    onChange={handleInputChange}
                                    autoComplete="country"
                                    className={`input-field${formData.country ? '' : ' is-empty'}`}
                                    aria-invalid={errors.country ? true : undefined}
                                    aria-describedby={errors.country ? 'register-country-error' : undefined}
                                >
                                    <option value="" disabled>Select your country</option>
                                    {COUNTRIES.map(country => (
                                        <option key={country.code} value={country.code}>
                                            {country.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} aria-hidden="true" />
                            </div>
                            {errors.country && (
                                <span id="register-country-error" className="field-error" role="alert">
                                    {errors.country}
                                </span>
                            )}
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="register-password">Password</label>
                            <div className="auth-password">
                                <input
                                    id="register-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="At least 6 characters"
                                    autoComplete="new-password"
                                    className="input-field"
                                    aria-invalid={errors.password ? true : undefined}
                                    aria-describedby={errors.password ? 'register-password-error' : undefined}
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
                                <span id="register-password-error" className="field-error" role="alert">
                                    {errors.password}
                                </span>
                            )}
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="register-confirmPassword">Confirm password</label>
                            <div className="auth-password">
                                <input
                                    id="register-confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    placeholder="Repeat your password"
                                    autoComplete="new-password"
                                    className="input-field"
                                    aria-invalid={errors.confirmPassword ? true : undefined}
                                    aria-describedby={errors.confirmPassword ? 'register-confirmPassword-error' : undefined}
                                />
                                <button
                                    type="button"
                                    className="icon-btn bare"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                                    aria-pressed={showConfirmPassword}
                                >
                                    {showConfirmPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <span id="register-confirmPassword-error" className="field-error" role="alert">
                                    {errors.confirmPassword}
                                </span>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="pill-btn primary lg block auth-submit"
                            disabled={submitting}
                        >
                            {submitting ? 'Creating account...' : 'Create account'}
                        </button>
                    </form>
                )}
            </section>

            <Link to="/login" className="auth-switch">
                Already have an account? <strong>Log in</strong>
            </Link>
        </div>
    );
};

export default Register;
