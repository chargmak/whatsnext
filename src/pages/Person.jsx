import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Star } from 'lucide-react';
import { getPersonDetails, getPersonCredits, imageUrl } from '../services/tmdb';
import { useUser } from '../context/UserContext';

// Circular "completion" ring showing how much of a person's filmography you've seen.
const CompletionRing = ({ percent, watched, total }) => {
    const size = 92;
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--bg-tertiary)" strokeWidth={stroke} />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--brand-600)" strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.8, ease: 'easeOut' }} />
            </svg>
            <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center'
            }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1 }}>{percent}%</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{watched}/{total}</span>
            </div>
        </div>
    );
};

const CreditCard = ({ credit, isSeen, onOpen, onToggle }) => (
    <div className="card" style={{ position: 'relative' }}>
        <img
            src={credit.poster}
            alt={credit.title}
            loading="lazy"
            onClick={onOpen}
            style={{ cursor: 'pointer', opacity: isSeen ? 0.55 : 1 }}
        />
        <button
            onClick={onToggle}
            aria-label={isSeen ? 'Mark unwatched' : 'Mark watched'}
            style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '30px', height: '30px', borderRadius: '50%',
                border: `2px solid ${isSeen ? 'var(--brand-600)' : 'rgba(255,255,255,0.7)'}`,
                background: isSeen ? 'var(--brand-600)' : 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 2, backdropFilter: 'blur(4px)'
            }}
        >
            <Check size={16} color="white" strokeWidth={3} style={{ opacity: isSeen ? 1 : 0.85 }} />
        </button>
        <div className="card-content" onClick={onOpen} style={{ cursor: 'pointer' }}>
            <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {credit.title}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {credit.year || '—'}{credit.character ? ` · ${credit.character}` : credit.job ? ` · ${credit.job}` : ''}
            </p>
        </div>
    </div>
);

const Person = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { status, watched, markAsWatched, removeFromWatched } = useUser();

    const [person, setPerson] = useState(null);
    const [credits, setCredits] = useState({ cast: [], crew: [] });
    const [loading, setLoading] = useState(true);
    const [bioExpanded, setBioExpanded] = useState(false);
    const [onlyUnseen, setOnlyUnseen] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            const [p, c] = await Promise.all([getPersonDetails(id), getPersonCredits(id)]);
            if (!active) return;
            setPerson(p);
            setCredits(c || { cast: [], crew: [] });
            setLoading(false);
        };
        load();
        return () => { active = false; };
    }, [id]);

    const watchedSet = useMemo(
        () => new Set(watched.map((m) => `${m.type}-${m.id}`)),
        [watched]
    );
    const isSeen = (credit) => watchedSet.has(`${credit.type}-${credit.id}`);

    // Completion is measured across the union of acting + directing/writing credits.
    const allCredits = useMemo(() => {
        const seen = new Set();
        return [...credits.cast, ...credits.crew].filter((c) => {
            const key = `${c.type}-${c.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [credits]);

    const seenCount = allCredits.filter(isSeen).length;
    const percent = allCredits.length ? Math.round((seenCount / allCredits.length) * 100) : 0;

    const withUser = (action) => {
        if (status === 'signedOut') { navigate('/login'); return; }
        action();
    };

    const toggleSeen = (credit) => withUser(() => {
        if (isSeen(credit)) {
            removeFromWatched({ id: credit.id, type: credit.type });
        } else {
            markAsWatched({
                id: credit.id,
                type: credit.type,
                title: credit.title,
                poster: credit.poster,
                rating: credit.rating,
                year: credit.year,
                releaseDate: credit.releaseDate,
            });
        }
    });

    const openCredit = (credit) => navigate(`/${credit.type}/${credit.id}`);

    const visibleCast = onlyUnseen ? credits.cast.filter((c) => !isSeen(c)) : credits.cast;
    const visibleCrew = onlyUnseen ? credits.crew.filter((c) => !isSeen(c)) : credits.crew;

    if (loading) return <div className="container flex-center" style={{ height: '100vh' }}>Loading...</div>;
    if (!person) return <div className="container flex-center" style={{ height: '100vh' }}>Person not found</div>;

    const bio = person.biography || '';
    const bioIsLong = bio.length > 320;

    const renderSection = (heading, list) => list.length > 0 && (
        <div style={{ marginTop: '28px' }}>
            <h3 style={{ marginBottom: '14px' }}>{heading} <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.9rem' }}>({list.length})</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '14px' }}>
                {list.map((credit) => (
                    <CreditCard
                        key={`${credit.type}-${credit.id}`}
                        credit={credit}
                        isSeen={isSeen(credit)}
                        onOpen={() => openCredit(credit)}
                        onToggle={() => toggleSeen(credit)}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <div style={{ paddingBottom: '100px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
            <div className="container" style={{ paddingTop: '20px' }}>
                <button onClick={() => navigate(-1)} className="top-bar-btn" style={{ marginBottom: '20px' }}>
                    <ArrowLeft size={24} />
                </button>

                {/* Header: photo + completion ring */}
                <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <img
                        src={imageUrl(person.profile_path, 'w300', 'https://via.placeholder.com/300x450?text=No+Photo')}
                        alt={person.name}
                        style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-tertiary)' }}
                    />
                    <div style={{ flex: 1, minWidth: '140px' }}>
                        <h1 style={{ fontSize: '1.8rem', margin: 0, lineHeight: 1.1 }}>{person.name}</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.9rem' }}>
                            {person.known_for_department || 'Acting'}
                            {person.birthday ? ` · b. ${person.birthday.split('-')[0]}` : ''}
                        </p>
                        {person.place_of_birth && (
                            <p style={{ color: 'var(--text-tertiary)', margin: '2px 0 0', fontSize: '0.82rem' }}>{person.place_of_birth}</p>
                        )}
                    </div>
                </div>

                {/* Completion tracker */}
                {allCredits.length > 0 && (
                    <div className="glass-panel" style={{
                        marginTop: '20px', padding: '18px', borderRadius: 'var(--radius-lg)',
                        display: 'flex', alignItems: 'center', gap: '18px'
                    }}>
                        <CompletionRing percent={percent} watched={seenCount} total={allCredits.length} />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                                <Star size={16} fill="var(--brand-600)" color="var(--brand-600)" /> Filmography completion
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '6px 0 12px' }}>
                                {seenCount === allCredits.length && allCredits.length > 0
                                    ? `Completionist! You've seen every notable title.`
                                    : `You've seen ${seenCount} of ${allCredits.length} notable titles.`}
                            </p>
                            <button
                                onClick={() => setOnlyUnseen((v) => !v)}
                                className="meta-tag"
                                style={{
                                    cursor: 'pointer', background: onlyUnseen ? 'var(--accent-primary)' : 'transparent',
                                    color: onlyUnseen ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                {onlyUnseen ? 'Showing to-watch' : 'Show only to-watch'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Biography */}
                {bio && (
                    <div style={{ marginTop: '24px' }}>
                        <h3 style={{ marginBottom: '10px' }}>Biography</h3>
                        <p style={{ lineHeight: 1.6, color: '#ccc', fontSize: '0.95rem' }}>
                            {bioIsLong && !bioExpanded ? `${bio.slice(0, 320).trim()}…` : bio}
                        </p>
                        {bioIsLong && (
                            <button
                                onClick={() => setBioExpanded((v) => !v)}
                                style={{ background: 'none', border: 'none', color: 'var(--brand-600)', cursor: 'pointer', padding: '6px 0', fontWeight: 600 }}
                            >
                                {bioExpanded ? 'Show less' : 'Read more'}
                            </button>
                        )}
                    </div>
                )}

                {renderSection('Acting', visibleCast)}
                {renderSection('Directing & Writing', visibleCrew)}

                {onlyUnseen && visibleCast.length === 0 && visibleCrew.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
                        You've watched everything here. 🎉
                    </p>
                )}
            </div>
        </div>
    );
};

export default Person;
