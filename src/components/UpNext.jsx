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

// Has the viewer ticked off any episode of this show at all?
const hasStarted = (episodes) =>
    Object.values(episodes || {}).some((eps) => eps.length > 0);

// Order the list the way the viewer moves through it: the show watched most
// recently first, then back through their history, and finally the shows they
// have in the list but have never started. Shows started before the app kept
// timestamps (legacy guest data) have no stamp to place them by, so they sit
// between the two — after the datable history, ahead of the untouched shows.
const activityRank = (started, lastWatchedAt) => {
    if (lastWatchedAt) return 0;
    return started ? 1 : 2;
};

const byRecency = (a, b) => {
    const rank = activityRank(a.started, a.lastWatchedAt) - activityRank(b.started, b.lastWatchedAt);
    if (rank !== 0) return rank;
    if (a.lastWatchedAt && b.lastWatchedAt) return b.lastWatchedAt - a.lastWatchedAt;
    return (a.show.title || '').localeCompare(b.show.title || '');
};

// How many shows to resolve at once when only a preview is needed. Each
// unresolved show costs two or more TMDB requests, so the home page works
// through the list in recency order and stops as soon as it has enough.
const PREVIEW_BATCH = 6;

// "Up Next": for every TV show passed in, resolve the next episode the viewer
// should watch — the earliest aired episode they haven't marked as seen — and
// list only the shows that actually have one waiting. Marking an episode here
// advances that show to its following episode in place. `limit` trims the list
// to its first N entries (the homepage shows a preview, the Library shows all).
const UpNext = ({ series, limit }) => {
    const navigate = useNavigate();
    const { watchedEpisodes, episodeActivity, toggleEpisodeWatched, timeZone } = useUser();
    const [nextByShow, setNextByShow] = useState({}); // tvId -> episode | null
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // Only re-resolve when the set of tracked shows changes, not on every
    // episode toggle (those are handled in place by handleMarkWatched).
    const seriesKey = series.map((s) => s.id).join(',');

    useEffect(() => {
        let active = true;
        setLoading(true);

        const resolve = async (show) => {
            const next = await getNextUnwatchedEpisode(show.id, watchedEpisodes[String(show.id)] || {}, timeZone);
            // Fall back to the poster we already have saved if TMDB omitted one.
            if (next && !next.poster && show.poster) next.poster = show.poster;
            return [show.id, next];
        };

        const load = async () => {
            // The display order (most recently watched first) is known before
            // any request is made, so when only a preview is wanted the shows
            // can be resolved in that order and the rest left alone.
            const ordered = [...series].sort((a, b) => byRecency(
                { show: a, started: hasStarted(watchedEpisodes[String(a.id)]), lastWatchedAt: episodeActivity?.[String(a.id)] || null },
                { show: b, started: hasStarted(watchedEpisodes[String(b.id)]), lastWatchedAt: episodeActivity?.[String(b.id)] || null },
            ));

            const entries = [];
            if (limit) {
                let found = 0;
                for (let i = 0; i < ordered.length && found < limit; i += PREVIEW_BATCH) {
                    const batch = await Promise.all(ordered.slice(i, i + PREVIEW_BATCH).map(resolve));
                    if (!active) return;
                    entries.push(...batch);
                    found += batch.filter(([, next]) => next).length;
                }
            } else {
                entries.push(...await Promise.all(ordered.map(resolve)));
            }
            if (!active) return;
            setNextByShow(Object.fromEntries(entries));
            setLoading(false);
        };

        load();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seriesKey, timeZone, limit]);

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

    const ordered = series
        .map((show) => ({
            show,
            ep: nextByShow[show.id],
            started: hasStarted(watchedEpisodes[String(show.id)]),
            lastWatchedAt: episodeActivity?.[String(show.id)] || null,
        }))
        .filter((entry) => entry.ep)
        .sort(byRecency);

    const upNext = limit ? ordered.slice(0, limit) : ordered;

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
                    className="glass-panel upnext-card"
                    onClick={() => navigate(`/tv/${show.id}`)}
                >
                    {/* Layout lives in CSS (.upnext-*) so phones can shrink the
                        still and collapse the button to its icon — inline, the
                        128px still plus a labelled button left the titles
                        truncated to a few letters on a 390px screen. */}
                    <img
                        src={ep.still || ep.poster}
                        alt={show.title}
                        loading="lazy"
                        className={`upnext-still ${ep.still ? '' : 'is-poster'}`}
                    />

                    <div className="upnext-body">
                        <div className="upnext-show">{ep.title}</div>
                        <div className="upnext-code">S{ep.seasonNumber} · E{ep.episodeNumber}</div>
                        <div className="upnext-episode">{ep.episodeName}</div>
                        {ep.airDate && <div className="upnext-aired">{formatAired(ep)}</div>}
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
                        className="upnext-btn"
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
