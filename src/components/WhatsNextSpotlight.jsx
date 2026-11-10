import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Check, X, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSpotlightQueue, PLACEHOLDER_POSTER } from '../services/tmdb';
import { useUser } from '../context/UserContext';

// ---- Spotlight taste memory --------------------------------------------
// The showcase remembers two device-level signals (guests have no account to
// store them in), each a capped localStorage list of { key: "movie-123",
// genres: [...] } entries:
//   • SKIPPED   — soft skips recorded by earlier versions ("Show another").
//                 Still honoured: don't surface that exact title again.
//   • DISMISSED — "Not for me" taps. A hard veto: never show it again AND let
//                 its genres nudge similar titles down the next proposals.
// Both feed the queue's exclude set; only DISMISSED feeds the genre penalty.
const SKIPPED_KEY = 'whatsnext_skipped';
const DISMISSED_KEY = 'whatsnext_dismissed';
const MEMORY_CAP = 200;

// Tolerate the legacy shape (bare "type-id" strings, pre-genre-tracking) so a
// user's existing dismissals keep excluding after this change.
const normalizeEntry = (entry) =>
    typeof entry === 'string'
        ? { key: entry, genres: [] }
        : { key: entry?.key, genres: Array.isArray(entry?.genres) ? entry.genres : [] };

const readMemory = (storageKey) => {
    try {
        const list = JSON.parse(localStorage.getItem(storageKey));
        return Array.isArray(list) ? list.map(normalizeEntry).filter((e) => e.key) : [];
    } catch {
        return [];
    }
};

const rememberItem = (storageKey, item) => {
    const entryKey = `${item.type}-${item.id}`;
    const list = readMemory(storageKey).filter((e) => e.key !== entryKey);
    list.push({ key: entryKey, genres: item.genres || [] });
    localStorage.setItem(storageKey, JSON.stringify(list.slice(-MEMORY_CAP)));
};

const clearMemory = (storageKey, type) => {
    const list = readMemory(storageKey).filter((e) => !e.key.startsWith(`${type}-`));
    localStorage.setItem(storageKey, JSON.stringify(list));
};

const entriesForType = (storageKey, type) =>
    readMemory(storageKey).filter((e) => e.key.startsWith(`${type}-`));

// Ids of every title the user has skipped OR vetoed for this media type — all
// kept out of future queues so a pick never comes back around.
const getExcludedIds = (type) => new Set(
    [...entriesForType(SKIPPED_KEY, type), ...entriesForType(DISMISSED_KEY, type)]
        .map((e) => Number(e.key.slice(type.length + 1)))
);

// A genre → count tally built only from vetoed ("Not for me") titles. Passed to
// the queue so recommendations sharing those genres get ranked lower. Skips are
// deliberately excluded — skipping a title isn't disliking its whole genre.
const getDislikedGenres = (type) => {
    const tally = {};
    entriesForType(DISMISSED_KEY, type).forEach((e) => {
        e.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1; });
    });
    return tally;
};

/**
 * The app's namesake feature, as a Home tile: one proposal at a time, seeded
 * from what the user has watched (falling back to their list, then to trending
 * for brand-new users). Every action is one tap and moves on to the next pick
 * from a prefetched queue: save it, mark it seen, or veto it for good. The
 * title opens the detail page (trailer, where to watch, the full plot).
 */
export const WhatsNextSpotlight = ({ mediaType }) => {
    const { status, watched, watchlist, watchedTvIds, addToWatchlist, markTitleWatched } = useUser();
    const navigate = useNavigate();
    const [reloadKey, setReloadKey] = useState(0);
    // The loaded queue is tagged with the request it answers; while the tag
    // doesn't match the current request (tab switched, retry pressed) the
    // section is in its loading state — no synchronous state resets needed.
    const requestKey = `${mediaType}|${status}|${reloadKey}`;
    const [result, setResult] = useState({ key: null, queue: [], index: 0, error: false });
    // The build effect reads the lists through a ref so `watched`/`watchlist`
    // stay out of its deps: tapping "Seen it" updates `watched` but must
    // advance the queue, not rebuild it back to a skeleton. The sync effect
    // is declared first so the ref is fresh before any rebuild runs.
    const dataRef = useRef({ watched, watchlist, watchedTvIds });
    useEffect(() => {
        dataRef.current = { watched, watchlist, watchedTvIds };
    });

    useEffect(() => {
        let active = true;
        const load = async () => {
            const { watched: seen, watchlist: saved, watchedTvIds: seenShows } = dataRef.current;
            const history = seen.filter((item) => item.type === mediaType);
            const list = saved.filter((item) => item.type === mediaType);
            // Shows with ticked-off episodes count as seen here too — they never
            // needed an explicit "mark watched" to be watched.
            const excludeIds = new Set([
                ...history.map((item) => item.id),
                ...list.map((item) => item.id),
                ...(mediaType === 'tv' ? seenShows : []),
                ...getExcludedIds(mediaType),
            ]);
            const items = await getSpotlightQueue({
                seeds: history.length ? history : list,
                type: mediaType,
                excludeIds,
                dislikedGenres: getDislikedGenres(mediaType),
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
    const exhausted = phase === 'ready' && queue.length > 0 && !current;
    const empty = phase === 'ready' && queue.length === 0 && !result.error;
    // Warm the next pick's poster so moving on feels instant.
    useEffect(() => {
        const next = queue[index + 1];
        if (next?.poster) {
            const img = new Image();
            img.src = next.poster;
        }
    }, [queue, index]);

    // Move to the next queued card without recording anything (used after an
    // action that already recorded its own signal, e.g. saving or vetoing).
    const advance = () => setResult((r) => ({ ...r, index: r.index + 1 }));

    // My List / Seen it write to the account (or guest storage) — fully
    // signed-out visitors get routed to login, same as the detail page.
    const guarded = (action) => () => {
        if (status === 'signedOut') {
            navigate('/login');
            return;
        }
        action(current);
        advance();
    };

    const notInterested = () => {
        rememberItem(DISMISSED_KEY, current);
        advance();
    };

    const startOver = () => {
        clearMemory(SKIPPED_KEY, mediaType);
        clearMemory(DISMISSED_KEY, mediaType);
        setReloadKey((k) => k + 1);
    };

    const label = mediaType === 'movie' ? 'movie' : 'show';

    const panel = (message, action) => (
        <section className="tile span-2 pick-tile pick-panel">
            <div className="tile-label pick-eyebrow">What&apos;s next?</div>
            <p>{message}</p>
            {action}
        </section>
    );

    if (phase === 'loading') {
        return <section className="tile span-2 pick-tile skeleton" aria-busy="true" aria-label="Finding a pick" />;
    }

    if (phase === 'error') {
        return panel('Couldn\u2019t load picks right now.', (
            <button className="pill-btn inverse" onClick={() => setReloadKey((k) => k + 1)}>
                <RefreshCw size={16} aria-hidden="true" /> Retry
            </button>
        ));
    }

    if (empty) {
        return panel(`No ${label}s to propose right now.`, (
            <button className="pill-btn inverse" onClick={startOver}>
                <RotateCcw size={16} aria-hidden="true" /> Start over
            </button>
        ));
    }

    if (exhausted || !current) {
        return panel('That\u2019s everything for now \u2014 you\u2019ve seen all our picks.', (
            <button className="pill-btn inverse" onClick={startOver}>
                <RotateCcw size={16} aria-hidden="true" /> Start over
            </button>
        ));
    }

    const facts = [
        current.match != null ? `${current.match}% match` : (current.rating && current.rating !== 'N/A' ? `${current.rating} rating` : null),
        current.genres[0] || null,
    ].filter(Boolean).join(' · ');

    return (
        <section className="tile span-2 pick-tile">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={`${current.type}-${current.id}`}
                    className="pick-body"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                >
                    <button
                        type="button"
                        className="pick-poster"
                        onClick={() => navigate(`/${current.type}/${current.id}`)}
                        aria-label={`Open ${current.title}`}
                    >
                        <img src={current.poster || PLACEHOLDER_POSTER} alt="" />
                    </button>
                    <div className="pick-info">
                        <div className="pick-eyebrow">What&apos;s next?</div>
                        <button
                            type="button"
                            className="pick-title"
                            onClick={() => navigate(`/${current.type}/${current.id}`)}
                        >
                            {current.title}
                        </button>
                        <div className="pick-reason">
                            {current.becauseOf ? `Because you watched ${current.becauseOf}` : 'Trending now'}
                        </div>
                        {facts && <div className="mono-label pick-facts">{facts}</div>}
                        <div className="pick-actions">
                            <button type="button" className="pill-btn inverse pick-save" onClick={guarded(addToWatchlist)}>
                                Save
                            </button>
                            <button type="button" className="icon-btn" onClick={guarded(markTitleWatched)} aria-label="Seen it" title="Seen it">
                                <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                            <button type="button" className="icon-btn" onClick={notInterested} aria-label="Not for me" title="Not for me">
                                <X size={18} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </section>
    );
};
