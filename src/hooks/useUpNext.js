import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getNextUnwatchedEpisode } from '../services/tmdb';

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
// unresolved show costs two or more TMDB requests, so a preview works through
// the list in recency order and stops as soon as it has enough.
const PREVIEW_BATCH = 6;

/**
 * The next unwatched, already-aired episode of every tracked series, most
 * recently watched show first. Shows that are fully caught up drop out.
 * `limit` trims the result to its first N entries (Home shows one, the Library
 * shows all) and stops resolving shows once it has that many.
 *
 * Returns { loading, items: [{ show, ep }], busyId, markWatched(show, ep) }.
 * Marking an episode advances that show to its following episode in place.
 */
export const useUpNext = (series, limit) => {
    const { watchedEpisodes, episodeActivity, toggleEpisodeWatched, timeZone } = useUser();
    const [nextByShow, setNextByShow] = useState({}); // tvId -> episode | null
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // Only re-resolve when the set of tracked shows changes, not on every
    // episode toggle (those are handled in place by markWatched).
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
    const markWatched = async (show, ep) => {
        if (busyId === show.id) return;
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

    const ordered = series
        .map((show) => ({
            show,
            ep: nextByShow[show.id],
            started: hasStarted(watchedEpisodes[String(show.id)]),
            lastWatchedAt: episodeActivity?.[String(show.id)] || null,
        }))
        .filter((entry) => entry.ep)
        .sort(byRecency);

    const items = (limit ? ordered.slice(0, limit) : ordered).map(({ show, ep }) => ({ show, ep }));

    return { loading, items, busyId, markWatched };
};
