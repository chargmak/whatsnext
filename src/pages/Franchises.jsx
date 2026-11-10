import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Layers } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useFranchises } from '../hooks/useFranchiseProgress';
import { releaseInstant, viewerDayRule } from '../services/releaseTime';
import '../styles/franchises.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const Franchise = ({ franchise, open, onToggle }) => {
    const { timeZone, watchlist, addToWatchlist, markAsWatched, removeFromWatched } = useUser();
    const now = new Date();
    // A film with no date, or a date still ahead, can't have been watched yet.
    const isOut = (film) =>
        Boolean(film.releaseDate) && releaseInstant(film.releaseDate, viewerDayRule(timeZone)) <= now;

    const toggle = (film) => {
        if (film.watched) {
            removeFromWatched({ id: film.id, type: 'movie' });
        } else {
            markAsWatched({
                id: film.id,
                type: 'movie',
                title: film.title,
                poster: film.poster,
                rating: film.rating,
                year: film.year,
                releaseDate: film.releaseDate,
            });
        }
    };

    const saved = new Set(watchlist.filter((m) => (m.type || 'movie') === 'movie').map((m) => m.id));
    const toSave = franchise.films.filter((f) => !f.watched && !saved.has(f.id));
    const addRemaining = () => toSave.forEach((f) => addToWatchlist({
        id: f.id,
        type: 'movie',
        title: f.title,
        poster: f.poster,
        rating: f.rating,
        year: f.year,
        releaseDate: f.releaseDate,
    }));

    const panelId = `franchise-${franchise.id}`;

    return (
        <li className="tile fr-tile">
            <button type="button" className="fr-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
                <span className="fr-head-row">
                    <span className="fr-name">{franchise.name}</span>
                    <span className="fr-head-side">
                        <span className={`pill-tag ${franchise.complete ? 'fr-pill-done' : ''}`}>
                            {franchise.complete ? 'Complete' : `${franchise.watched}/${franchise.total} watched`}
                        </span>
                        <ChevronDown size={18} className="fr-chevron" aria-hidden="true" />
                    </span>
                </span>
                <span
                    className="fr-bar"
                    role="progressbar"
                    aria-label={`${franchise.name} progress`}
                    aria-valuemin={0}
                    aria-valuemax={franchise.total}
                    aria-valuenow={franchise.watched}
                    style={{ display: 'block' }}
                >
                    <span className="fr-bar-fill" style={{ display: 'block', width: `${(franchise.watched / franchise.total) * 100}%` }} />
                </span>
                <span className="fr-next" style={{ display: 'block' }}>
                    {franchise.complete
                        ? `All ${franchise.total} films watched`
                        : <>Next: <strong>{franchise.next.title}</strong>{franchise.next.year ? ` (${franchise.next.year})` : ''}</>}
                </span>
            </button>

            {open && (
                <div id={panelId}>
                    <ul className="fr-films">
                        {franchise.films.map((film) => {
                            const out = isOut(film);
                            return (
                                <li key={film.id} className="fr-film">
                                    <button
                                        type="button"
                                        className="fr-tick"
                                        aria-pressed={film.watched}
                                        aria-label={film.watched ? `Mark ${film.title} as not watched` : `Mark ${film.title} as watched`}
                                        disabled={!out && !film.watched}
                                        onClick={() => toggle(film)}
                                    >
                                        <span><Check size={14} strokeWidth={3} aria-hidden="true" /></span>
                                    </button>
                                    <Link to={`/movie/${film.id}`} className="fr-film-link">
                                        <span className="truncate">{film.title}</span>
                                        <span className="mono-label">{out ? film.year : (film.year ? `${film.year} · not out` : 'Not out')}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    {toSave.length > 0 && (
                        <button type="button" className="pill-btn inverse fr-add" onClick={addRemaining}>
                            Add remaining to watchlist
                        </button>
                    )}
                </div>
            )}
        </li>
    );
};

const Franchises = () => {
    const navigate = useNavigate();
    const { loading, franchises } = useFranchises();
    // Open the one closest to being finished to begin with.
    const [openId, setOpenId] = useState(undefined);
    const firstId = franchises[0]?.id;
    const current = openId === undefined ? firstId : openId;

    const inProgress = franchises.filter((f) => !f.complete && f.watched > 0).length;
    const complete = franchises.filter((f) => f.complete).length;
    const notStarted = franchises.length - inProgress - complete;
    const summary = [
        inProgress ? `${inProgress} in progress` : null,
        notStarted ? `${notStarted} not started` : null,
        complete ? `${complete} complete` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="container page">
            <header className="sub-header">
                <button type="button" className="icon-btn on-page" onClick={() => navigate(-1)} aria-label="Back">
                    <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <h1>Franchises</h1>
            </header>

            {loading ? (
                <div aria-busy="true" aria-label="Loading your franchises" className="page">
                    <div className="skeleton fr-skeleton" />
                    <div className="skeleton fr-skeleton" />
                    <div className="skeleton fr-skeleton" />
                </div>
            ) : franchises.length === 0 ? (
                <div className="empty-state">
                    <Layers size={40} aria-hidden="true" style={{ opacity: 0.4, marginBottom: '12px' }} />
                    <p>No franchises yet.</p>
                    <p style={{ fontSize: '0.875rem' }}>
                        Watch or save a movie that belongs to a series of films and its progress shows up here.
                    </p>
                    <Link to="/search" className="pill-btn primary" style={{ marginTop: '8px' }}>Find movies</Link>
                </div>
            ) : (
                <>
                    <p className="mono-label">{plural(franchises.length, 'franchise')} · {summary}</p>
                    <ul className="page" style={{ listStyle: 'none', gap: '12px' }}>
                        {franchises.map((f) => (
                            <Franchise
                                key={f.id}
                                franchise={f}
                                open={current === f.id}
                                onToggle={() => setOpenId(current === f.id ? null : f.id)}
                            />
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default Franchises;
