import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { getPersonDetails, getPersonCredits, imageUrl } from '../services/tmdb';
import { useUser } from '../context/UserContext';
import '../styles/person.css';

// Circular "completion" ring showing how much of a person's filmography you've seen.
const CompletionRing = ({ percent }) => {
    const size = 72;
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return (
        <div className="person-ring" role="img" aria-label={`${percent} percent of filmography watched`}>
            <svg width={size} height={size} aria-hidden="true">
                <circle className="person-ring-track" cx={size / 2} cy={size / 2} r={radius}
                    fill="none" strokeWidth={stroke} />
                <motion.circle className="person-ring-fill" cx={size / 2} cy={size / 2} r={radius}
                    fill="none" strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.8, ease: 'easeOut' }} />
            </svg>
            <span className="person-ring-percent" aria-hidden="true">{percent}%</span>
        </div>
    );
};

const CreditCard = ({ credit, isSeen, to, onToggle }) => (
    <div className="card">
        <Link to={to} className="person-credit-link">
            <img src={credit.poster} alt="" loading="lazy" />
            <div className="card-content">
                <div className="card-title">{credit.title}</div>
                <div className="card-meta">
                    {credit.year || '—'}{credit.character ? ` · ${credit.character}` : credit.job ? ` · ${credit.job}` : ''}
                </div>
            </div>
        </Link>
        <button
            type="button"
            className="person-tick"
            onClick={onToggle}
            aria-pressed={isSeen}
            aria-label={`${isSeen ? 'Mark unwatched' : 'Mark watched'}: ${credit.title}`}
        >
            <Check size={16} strokeWidth={3} aria-hidden="true" />
        </button>
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

    const visibleCast = onlyUnseen ? credits.cast.filter((c) => !isSeen(c)) : credits.cast;
    const visibleCrew = onlyUnseen ? credits.crew.filter((c) => !isSeen(c)) : credits.crew;

    if (loading) {
        return (
            <div className="container person-status" role="status">
                <div className="spinner"></div>
                Loading...
            </div>
        );
    }
    if (!person) {
        return (
            <div className="container person-status">
                Person not found
                <button type="button" className="pill-btn on-page" onClick={() => navigate(-1)}>
                    <ArrowLeft size={16} aria-hidden="true" /> Go back
                </button>
            </div>
        );
    }

    const bio = person.biography || '';
    const bioIsLong = bio.length > 320;
    const complete = seenCount === allCredits.length && allCredits.length > 0;

    const renderSection = (heading, list) => list.length > 0 && (
        <section className="person-section">
            <h2 className="section-title">
                {heading} <span className="person-section-count">({list.length})</span>
            </h2>
            <div className="grid-layout">
                {list.map((credit) => (
                    <CreditCard
                        key={`${credit.type}-${credit.id}`}
                        credit={credit}
                        isSeen={isSeen(credit)}
                        to={`/${credit.type}/${credit.id}`}
                        onToggle={() => toggleSeen(credit)}
                    />
                ))}
            </div>
        </section>
    );

    return (
        <div className="container page person-page">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="icon-btn on-page"
                aria-label="Back"
            >
                <ArrowLeft size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>

            {/* Header: photo + name */}
            <header className="person-header">
                <img
                    className="person-photo"
                    src={imageUrl(person.profile_path, 'w300')}
                    alt={person.name}
                />
                <div className="person-header-body">
                    <h1 className="person-name">{person.name}</h1>
                    <div className="mono-label person-role">
                        {person.known_for_department || 'Acting'}
                        {person.birthday ? ` · b. ${person.birthday.split('-')[0]}` : ''}
                    </div>
                    {person.place_of_birth && (
                        <p className="person-birthplace">{person.place_of_birth}</p>
                    )}
                </div>
            </header>

            {/* Completion tracker */}
            {allCredits.length > 0 && (
                <section className="tile">
                    <h2 className="tile-label person-completion-label">Filmography completion</h2>
                    <div className="person-completion-row">
                        <CompletionRing percent={percent} />
                        <div>
                            <div className="person-count">{seenCount}/{allCredits.length}</div>
                            <p className="person-summary">
                                {complete
                                    ? `Completionist! You've seen every notable title.`
                                    : `You've seen ${seenCount} of ${allCredits.length} notable titles.`}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOnlyUnseen((v) => !v)}
                        className={`pill-btn person-filter ${onlyUnseen ? 'inverse' : ''}`}
                        aria-pressed={onlyUnseen}
                    >
                        {onlyUnseen ? 'Showing to-watch' : 'Show only to-watch'}
                    </button>
                </section>
            )}

            {/* Biography */}
            {bio && (
                <section>
                    <h2 className="section-title">Biography</h2>
                    <p className="person-bio">
                        {bioIsLong && !bioExpanded ? `${bio.slice(0, 320).trim()}…` : bio}
                    </p>
                    {bioIsLong && (
                        <button
                            type="button"
                            onClick={() => setBioExpanded((v) => !v)}
                            className="link-accent"
                            aria-expanded={bioExpanded}
                        >
                            {bioExpanded ? 'Show less' : 'Read more'}
                        </button>
                    )}
                </section>
            )}

            {renderSection('Acting', visibleCast)}
            {renderSection('Directing & Writing', visibleCrew)}

            {onlyUnseen && visibleCast.length === 0 && visibleCrew.length === 0 && (
                <div className="empty-state">
                    <p>You've watched everything here.</p>
                </div>
            )}
        </div>
    );
};

export default Person;
