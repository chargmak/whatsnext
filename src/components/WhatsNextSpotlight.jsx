import React, { useEffect, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Info, RefreshCw, Play, Plus, Eye, ThumbsDown, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSpotlightQueue, getSpotlightExtras } from '../services/tmdb';
import { useUser } from '../context/UserContext';
import { TrailerModal } from './TrailerModal';

// ---- "Not for me" memory -----------------------------------------------
// Skips are a device-level taste signal (guests have no account to store them
// in), so they live in localStorage as ["movie-123", "tv-456", ...], capped so
// years of skipping can't grow the entry unbounded.
const DISMISSED_KEY = 'whatsnext_dismissed';
const DISMISSED_CAP = 200;

const readDismissed = () => {
    try {
        const list = JSON.parse(localStorage.getItem(DISMISSED_KEY));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
};

const getDismissed = (type) => new Set(
    readDismissed()
        .filter((key) => key.startsWith(`${type}-`))
        .map((key) => Number(key.slice(type.length + 1)))
);

const addDismissed = (item) => {
    const list = readDismissed().filter((key) => key !== `${item.type}-${item.id}`);
    list.push(`${item.type}-${item.id}`);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-DISMISSED_CAP)));
};

const clearDismissed = (type) => {
    const list = readDismissed().filter((key) => !key.startsWith(`${type}-`));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(list));
};

// Providers/trailer already fetched this session, keyed "type-id" — revisiting
// a card (or re-rendering) must not re-hit TMDB.
const extrasCache = new Map();

/**
 * The app's namesake feature: one full-bleed proposal at a time, seeded from
 * what the user has watched (falling back to their list, then to trending for
 * brand-new users). "Show another" advances through a prefetched queue, so it
 * is instant; everything else is one tap: open details, play the trailer,
 * save it, mark it seen, or veto it forever.
 */
export const WhatsNextSpotlight = ({ mediaType }) => {
    const { status, user, watched, watchlist, addToWatchlist, markTitleWatched } = useUser();
    const navigate = useNavigate();
    const [reloadKey, setReloadKey] = useState(0);
    // The loaded queue is tagged with the request it answers; while the tag
    // doesn't match the current request (tab switched, retry pressed) the
    // section is in its loading state — no synchronous state resets needed.
    const requestKey = `${mediaType}|${status}|${reloadKey}`;
    const [result, setResult] = useState({ key: null, queue: [], index: 0, error: false });
    // Bumped when an extras fetch lands so the cache-derived values re-render.
    const [, refreshExtras] = useReducer((v) => v + 1, 0);
    // Which card the trailer was opened for — advancing cards auto-closes it.
    const [trailerFor, setTrailerFor] = useState(null);

    // The build effect reads the lists through a ref so `watched`/`watchlist`
    // stay out of its deps: tapping "Seen it" updates `watched` but must
    // advance the queue, not rebuild it back to a skeleton. The sync effect
    // is declared first so the ref is fresh before any rebuild runs.
    const dataRef = useRef({ watched, watchlist });
    useEffect(() => {
        dataRef.current = { watched, watchlist };
    });

    useEffect(() => {
        let active = true;
        const load = async () => {
            const { watched: seen, watchlist: saved } = dataRef.current;
            const history = seen.filter((item) => item.type === mediaType);
            const list = saved.filter((item) => item.type === mediaType);
            const excludeIds = new Set([
                ...history.map((item) => item.id),
                ...list.map((item) => item.id),
                ...getDismissed(mediaType),
            ]);
            const items = await getSpotlightQueue({
                seeds: history.length ? history : list,
                type: mediaType,
                excludeIds,
            });
            if (!active) return;
            setResult({ key: requestKey, queue: items, index: 0, error: false });
        };
        load().catch(() => {
            if (active) setResult({ key: requestKey, queue: [], index: 0, error: true });
        });
        return () => { active = false; };
    }, [requestKey, mediaType]);

    const loaded = result.key === requestKey;
    const phase = !loaded ? 'loading' : (result.error ? 'error' : 'ready');
    const { queue, index } = loaded ? result : { queue: [], index: 0 };

    const current = queue[index] || null;
    const currentKey = current ? `${current.type}-${current.id}` : null;
    const exhausted = phase === 'ready' && queue.length > 0 && !current;
    const empty = phase === 'ready' && queue.length === 0 && !result.error;
    const extras = currentKey ? extrasCache.get(currentKey) : null;
    const showTrailer = trailerFor !== null && trailerFor === currentKey;

    // Fetch providers + trailer for the card on screen only (2 requests, cached).
    useEffect(() => {
        if (!current || extrasCache.has(`${current.type}-${current.id}`)) return;
        let active = true;
        getSpotlightExtras(current.id, current.type, user?.country || 'US')
            .catch(() => ({ providers: [], trailerKey: null }))
            .then((data) => {
                extrasCache.set(`${current.type}-${current.id}`, data);
                if (active) refreshExtras();
            });
        return () => { active = false; };
    }, [current, user?.country]);

    // Warm the next card's backdrop so "Show another" feels instant.
    useEffect(() => {
        const next = queue[index + 1];
        if (next?.backdrop) {
            const img = new Image();
            img.src = next.backdrop;
        }
    }, [queue, index]);

    const showAnother = () => setResult((r) => ({ ...r, index: r.index + 1 }));

    // My List / Seen it write to the account (or guest storage) — fully
    // signed-out visitors get routed to login, same as the detail page.
    const guarded = (action) => () => {
        if (status === 'signedOut') {
            navigate('/login');
            return;
        }
        action(current);
        showAnother();
    };

    const notInterested = () => {
        addDismissed(current);
        showAnother();
    };

    const startOver = () => {
        clearDismissed(mediaType);
        setReloadKey((k) => k + 1);
    };

    const label = mediaType === 'movie' ? 'movie' : 'show';

    return (
        <section style={{ marginBottom: '40px' }}>
            <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '10px', marginBottom: '4px' }}>
                <Sparkles size={20} color="var(--brand-600)" />
                <h3 style={{ margin: 0 }}>What&apos;s Next?</h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                One pick at a time, from what you&apos;ve watched
            </p>

            {phase === 'loading' && <div className="spotlight-card spotlight-skeleton" />}

            {phase === 'error' && (
                <div className="glass-panel spotlight-panel">
                    <p>Couldn&apos;t load picks right now.</p>
                    <button className="spotlight-btn primary" onClick={() => setReloadKey((k) => k + 1)}>
                        <RefreshCw size={17} /> Retry
                    </button>
                </div>
            )}

            {empty && (
                <div className="glass-panel spotlight-panel">
                    <p>No {label}s to propose right now.</p>
                    <button className="spotlight-btn primary" onClick={startOver}>
                        <RotateCcw size={17} /> Start over
                    </button>
                </div>
            )}

            {exhausted && (
                <div className="glass-panel spotlight-panel">
                    <p>That&apos;s everything for now — you&apos;ve seen all our picks.</p>
                    <button className="spotlight-btn primary" onClick={startOver}>
                        <RotateCcw size={17} /> Start over
                    </button>
                </div>
            )}

            {current && (
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={`${current.type}-${current.id}`}
                        className="spotlight-card"
                        initial={{ opacity: 0, x: 48, scale: 0.97 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -48, scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    >
                        <motion.img
                            className={`spotlight-backdrop ${current.backdrop ? '' : 'is-poster'}`}
                            src={current.backdrop || current.poster}
                            alt={current.title}
                            initial={{ scale: 1.08 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 6, ease: 'easeOut' }}
                        />
                        <div className="spotlight-scrim" />
                        <div className="spotlight-content">
                            <span className="spotlight-eyebrow">
                                {current.becauseOf ? `Because you watched ${current.becauseOf}` : 'Trending now'}
                            </span>
                            <h2 className="spotlight-title">{current.title}</h2>
                            <div className="spotlight-meta">
                                {current.match != null && <span className="spotlight-match">{current.match}% match</span>}
                                <span>{current.year}</span>
                                <span>★ {current.rating}</span>
                                {current.genres[0] && <span>{current.genres[0]}</span>}
                            </div>
                            {current.plot && <p className="spotlight-plot">{current.plot}</p>}
                            {extras?.providers?.length > 0 && (
                                <div className="spotlight-providers">
                                    {extras.providers.slice(0, 4).map((p) => (
                                        <img key={p.id} src={p.logo} alt={p.name} title={p.name} />
                                    ))}
                                </div>
                            )}
                            <div className="spotlight-actions">
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    className="spotlight-btn primary"
                                    onClick={() => navigate(`/${current.type}/${current.id}`)}
                                >
                                    <Info size={17} /> See details
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    className="spotlight-btn ghost"
                                    onClick={showAnother}
                                >
                                    <RefreshCw size={17} /> Show another
                                </motion.button>
                                {extras?.trailerKey && (
                                    <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        className="spotlight-btn ghost"
                                        onClick={() => setTrailerFor(currentKey)}
                                    >
                                        <Play size={17} /> Trailer
                                    </motion.button>
                                )}
                            </div>
                            <div className="spotlight-subactions">
                                <button className="spotlight-icon-btn" onClick={guarded(addToWatchlist)}>
                                    <Plus size={16} /> My List
                                </button>
                                <button className="spotlight-icon-btn" onClick={guarded(markTitleWatched)}>
                                    <Eye size={16} /> Seen it
                                </button>
                                <button className="spotlight-icon-btn" onClick={notInterested}>
                                    <ThumbsDown size={16} /> Not for me
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}

            <AnimatePresence>
                {showTrailer && extras?.trailerKey && current && (
                    <TrailerModal
                        trailerKey={extras.trailerKey}
                        title={current.title}
                        onClose={() => setTrailerFor(null)}
                    />
                )}
            </AnimatePresence>
        </section>
    );
};
