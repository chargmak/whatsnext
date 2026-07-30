import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Play, Tv } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { getNextUnwatchedEpisode } from '../services/tmdb';
import { PRECISION, describeRelease } from '../services/releaseTime';

// "Aired today at 9:00 PM" — the resolved moment in the viewer's own clock, with
// a ~ when the hour is a prime-time estimate rather than a published drop time.
const formatAired = (ep) => {
    if (!ep.air) return ep.airDate || '';
    const text = describeRelease(ep.air, { verb: 'air' });
    return ep.air.precision === PRECISION.ESTIMATED ? text.replace(' at ', ' at ~') : text;
};

// "Up Next": for every TV show passed in, resolve the next episode the viewer
// should watch — the earliest aired episode they haven't marked as seen — and
// list only the shows that actually have one waiting. Marking an episode here
// advances that show to its following episode in place.
const UpNext = ({ series }) => {
    const navigate = useNavigate();
    const { watchedEpisodes, toggleEpisodeWatched, timeZone } = useUser();
    const [nextByShow, setNextByShow] = useState({}); // tvId -> episode | null
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // Only re-resolve when the set of tracked shows changes, not on every
    // episode toggle (those are handled in place by handleMarkWatched).
    const seriesKey = series.map((s) => s.id).join(',');

    useEffect(() => {
        let active = true;
        setLoading(true);

        const load = async () => {
            const entries = await Promise.all(series.map(async (show) => {
                const next = await getNextUnwatchedEpisode(show.id, watchedEpisodes[String(show.id)] || {}, timeZone);
                // Fall back to the poster we already have saved if TMDB omitted one.
                if (next && !next.poster && show.poster) next.poster = show.poster;
                return [show.id, next];
            }));
            if (!active) return;
            setNextByShow(Object.fromEntries(entries));
            setLoading(false);
        };

        load();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seriesKey, timeZone]);

    // Mark the shown episode watched, then resolve that one show's next episode
    // so the card advances (or drops out when the viewer is caught up).
    const handleMarkWatched = async (show, ep) => {
        setBusyId(show.id);
        toggleEpisodeWatched(show.id, ep.seasonNumber, ep.episodeNumber);

        // toggle's state update is async, so build the post-mark map ourselves.
        const current = watchedEpisodes[String(show.id)] || {};
        const seasonKey = String(ep.seasonNumber);
        const updated = {
            ...current,
            [seasonKey]: [...(current[seasonKey] || []), ep.episodeNumber],
        };

        const next = await getNextUnwatchedEpisode(show.id, updated, timeZone);
        if (next && !next.poster && show.poster) next.poster = show.poster;
        setNextByShow((prev) => ({ ...prev, [show.id]: next }));
        setBusyId(null);
    };

    if (series.length === 0) {
        return (
            <div className="empty-state">
                <Tv size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>No TV shows in your list yet.</p>
                <button className="btn" style={{ marginTop: '10px' }} onClick={() => navigate('/search')}>
                    Find shows to watch
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                Finding your next episodes…
            </div>
        );
    }

    const upNext = series
        .map((show) => ({ show, ep: nextByShow[show.id] }))
        .filter((entry) => entry.ep);

    if (upNext.length === 0) {
        return (
            <div className="empty-state">
                <Check size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>You're all caught up!</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Every aired episode from the shows in your list has been watched.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {upNext.map(({ show, ep }) => (
                <motion.div
                    key={show.id}
                    layout
                    whileHover={{ scale: 1.01 }}
                    className="glass-panel"
                    onClick={() => navigate(`/tv/${show.id}`)}
                    style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'center',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}
                >
                    <img
                        src={ep.still || ep.poster}
                        alt={show.title}
                        loading="lazy"
                        style={{
                            width: ep.still ? '128px' : '60px',
                            height: ep.still ? '72px' : '90px',
                            borderRadius: 'var(--radius-sm)',
                            objectFit: 'cover',
                            flexShrink: 0,
                            background: 'var(--bg-tertiary)',
                        }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontWeight: 700,
                            marginBottom: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {ep.title}
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--brand-600)',
                            marginBottom: '4px',
                        }}>
                            S{ep.seasonNumber} · E{ep.episodeNumber}
                        </div>
                        <div style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {ep.episodeName}
                        </div>
                        {ep.airDate && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {formatAired(ep)}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (busyId !== show.id) handleMarkWatched(show, ep);
                        }}
                        disabled={busyId === show.id}
                        title="Mark this episode watched"
                        aria-label={`Mark ${show.title} S${ep.seasonNumber}E${ep.episodeNumber} watched`}
                        style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--brand-600)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: busyId === show.id ? 'default' : 'pointer',
                            opacity: busyId === show.id ? 0.6 : 1,
                        }}
                    >
                        {busyId === show.id ? <Check size={16} /> : <Play size={16} fill="white" />}
                        <span>Watched</span>
                    </button>
                </motion.div>
            ))}
        </div>
    );
};

export default UpNext;
