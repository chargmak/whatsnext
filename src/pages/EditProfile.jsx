import React, { useState } from 'react';
import { ArrowLeft, Camera, User, Mail, Calendar as CalendarIcon, Save, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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


const EditProfile = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useUser();

    const [formData, setFormData] = useState({
        name: user.name || 'Dimitrios',
        email: user.email || 'dimitrios@example.com',
        bio: user.bio || 'Movie and TV enthusiast',
        joinDate: user.joinDate || '2024-01-01',
        country: user.country || 'US',
        avatar: user.avatar
    });

    const [previewAvatar, setPreviewAvatar] = useState(user.avatar);

    // Predefined avatar options
    const avatarOptions = [
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasmine',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucy',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Robot1',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Robot2',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Pixel1',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=Pixel2'
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAvatarSelect = (avatarUrl) => {
        setPreviewAvatar(avatarUrl);
        setFormData(prev => ({
            ...prev,
            avatar: avatarUrl
        }));
    };

    const handleCustomAvatar = () => {
        const url = prompt('Enter image URL for your avatar:');
        if (url) {
            setPreviewAvatar(url);
            setFormData(prev => ({
                ...prev,
                avatar: url
            }));
        }
    };

    const handleSave = () => {
        // Update user context
        updateUser(formData);

        // Save to localStorage
        const currentUser = JSON.parse(localStorage.getItem('user_profile') || '{}');
        const updatedUser = { ...currentUser, ...formData };
        localStorage.setItem('user_profile', JSON.stringify(updatedUser));

        // Also update in app_users if exists
        const users = JSON.parse(localStorage.getItem('app_users') || '[]');
        const userIndex = users.findIndex(u => u.email === formData.email);
        if (userIndex !== -1) {
            users[userIndex] = { ...users[userIndex], ...formData };
            localStorage.setItem('app_users', JSON.stringify(users));
        }

        alert('Profile updated successfully!');
        navigate('/profile');
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
                    <User size={28} style={{ marginRight: '8px' }} />
                    Edit Profile
                </h1>
            </header>

            {/* Avatar Section */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Profile Picture</h3>

                {/* Current Avatar Preview */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={previewAvatar}
                            alt="Profile"
                            style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                border: '4px solid var(--brand-600)',
                                objectFit: 'cover'
                            }}
                        />
                        <button
                            onClick={handleCustomAvatar}
                            style={{
                                position: 'absolute',
                                bottom: '0',
                                right: '0',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--brand-600)',
                                border: '3px solid var(--bg-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Camera size={20} color="white" />
                        </button>
                    </div>
                </div>

                {/* Avatar Options Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px'
                }}>
                    {avatarOptions.map((avatar, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleAvatarSelect(avatar)}
                            style={{
                                cursor: 'pointer',
                                borderRadius: '50%',
                                border: previewAvatar === avatar
                                    ? '3px solid var(--brand-600)'
                                    : '3px solid transparent',
                                padding: '4px',
                                transition: 'all 0.2s',
                                background: previewAvatar === avatar
                                    ? 'rgba(220, 38, 38, 0.1)'
                                    : 'transparent'
                            }}
                        >
                            <img
                                src={avatar}
                                alt={`Avatar ${idx + 1}`}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    borderRadius: '50%',
                                    display: 'block'
                                }}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Profile Information */}
            <section style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '16px' }}>Profile Information</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Name */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <User size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Display Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="glass-panel"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--brand-600)'}
                            onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <Mail size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Email Address
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="glass-panel"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--brand-600)'}
                            onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Country */}
                    <div>
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
                            className="glass-panel"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--brand-600)'}
                            onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                        >
                            {COUNTRIES.map(country => (
                                <option key={country.code} value={country.code} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                        <p style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                            marginTop: '6px',
                            marginBottom: 0
                        }}>
                            This affects which streaming services are shown
                        </p>
                    </div>

                    {/* Bio */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            Bio
                        </label>
                        <textarea
                            name="bio"
                            value={formData.bio}
                            onChange={handleInputChange}
                            rows="3"
                            className="glass-panel"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--brand-600)'}
                            onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Join Date */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500'
                        }}>
                            <CalendarIcon size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            Member Since
                        </label>
                        <input
                            type="date"
                            name="joinDate"
                            value={formData.joinDate}
                            onChange={handleInputChange}
                            className="glass-panel"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--brand-600)'}
                            onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                        />
                    </div>
                </div>
            </section>

            {/* Save Button */}
            <button
                onClick={handleSave}
                className="action-btn primary"
                style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '20px'
                }}
            >
                <Save size={20} />
                Save Changes
            </button>

            {/* Cancel Button */}
            <button
                onClick={() => navigate('/profile')}
                className="action-btn secondary"
                style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    marginTop: '12px'
                }}
            >
                Cancel
            </button>
        </div>
    );
};

export default EditProfile;
