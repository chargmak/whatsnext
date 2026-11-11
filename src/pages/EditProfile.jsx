import React, { useState, useMemo } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { deviceTimeZone, formatZonedTime, timeZoneOptions } from '../services/releaseTime';
import { COUNTRIES } from '../data/countries';
import '../styles/account.css';

const EditProfile = () => {
    const navigate = useNavigate();
    const { user, updateUser, status } = useUser();
    const isAuthed = status === 'authed';

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        bio: user?.bio || '',
        country: user?.country || 'US',
        // '' means "follow this device" — release times then track the viewer as
        // they travel instead of being pinned to a zone they set once.
        timezone: user?.timezone || '',
        avatar: user?.avatar
    });
    const [saved, setSaved] = useState(false);

    const detectedZone = deviceTimeZone();
    const activeZone = formData.timezone || detectedZone;
    // Same clock the release calendar uses, so the label doubles as a preview.
    const zoneNow = formatZonedTime(new Date(), activeZone);
    const zoneOptions = useMemo(() => timeZoneOptions(), []);

    const memberSince = user?.joinDate
        ? new Date(user.joinDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';

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
        // Context persists to Supabase (authed) or localStorage (guest).
        // Email is managed by auth and never editable here.
        const { email: _email, ...updates } = formData;
        updateUser(updates);
        setSaved(true);
        setTimeout(() => navigate('/profile'), 800);
    };

    return (
        <div className="container page page-narrow">
            {/* Header */}
            <header className="sub-header">
                <button
                    type="button"
                    className="icon-btn on-page"
                    onClick={() => navigate('/profile')}
                    aria-label="Back to profile"
                >
                    <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <h1>Edit profile</h1>
            </header>

            {/* Avatar */}
            <section className="tile" aria-label="Profile picture">
                <div className="account-avatar-head">
                    <img src={previewAvatar} alt="Current profile picture" className="account-avatar-preview" />
                    <div>
                        <p className="account-avatar-title">Profile picture</p>
                        <button type="button" className="pill-btn" onClick={handleCustomAvatar}>
                            Use image URL
                        </button>
                    </div>
                </div>

                <div className="account-avatar-grid">
                    {avatarOptions.map((avatar, idx) => (
                        <button
                            key={avatar}
                            type="button"
                            className="account-avatar-option"
                            onClick={() => handleAvatarSelect(avatar)}
                            aria-label={`Preset avatar ${idx + 1}`}
                            aria-pressed={previewAvatar === avatar}
                        >
                            <img src={avatar} alt="" loading="lazy" />
                        </button>
                    ))}
                </div>
            </section>

            {/* Name */}
            <div className="field">
                <label className="field-label" htmlFor="profile-name">Display name</label>
                <input
                    id="profile-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="input-field"
                    autoComplete="name"
                />
            </div>

            {/* Email */}
            <div className="field">
                <label className="field-label" htmlFor="profile-email">Email address</label>
                <input
                    id="profile-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    readOnly
                    className="input-field"
                    aria-describedby="profile-email-note"
                />
                <span id="profile-email-note" className="field-note">
                    {isAuthed ? 'Your login email cannot be changed here.' : 'Guests have no email — create an account to get one.'}
                </span>
            </div>

            {/* Country */}
            <div className="field">
                <label className="field-label" htmlFor="profile-country">Country</label>
                <div className="account-select">
                    <select
                        id="profile-country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className="input-field"
                        aria-describedby="profile-country-note"
                    >
                        {COUNTRIES.map(country => (
                            <option key={country.code} value={country.code}>
                                {country.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                </div>
                <span id="profile-country-note" className="field-note">
                    This affects which streaming services are shown.
                </span>
            </div>

            {/* Time zone — decides what clock release times are shown in */}
            <div className="field">
                <label className="field-label" htmlFor="profile-timezone">Time zone</label>
                <div className="account-select">
                    <select
                        id="profile-timezone"
                        name="timezone"
                        value={formData.timezone}
                        onChange={handleInputChange}
                        className="input-field"
                        aria-describedby="profile-timezone-note"
                    >
                        <option value="">
                            Use this device ({detectedZone})
                        </option>
                        {zoneOptions.map((zone) => (
                            <option key={zone} value={zone}>
                                {zone.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                </div>
                <span id="profile-timezone-note" className="field-note">
                    Release and episode times are shown in this zone — it's {zoneNow} there now.
                </span>
            </div>

            {/* Bio */}
            <div className="field">
                <label className="field-label" htmlFor="profile-bio">Bio</label>
                <textarea
                    id="profile-bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="A line about what you like to watch"
                    className="input-field"
                />
            </div>

            <p className="account-meta">Member since {memberSince}</p>

            <div className="account-actions">
                <button type="button" onClick={handleSave} className="pill-btn primary lg block">
                    {saved ? 'Saved!' : 'Save changes'}
                </button>
                <button type="button" onClick={() => navigate('/profile')} className="account-text-btn">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default EditProfile;
