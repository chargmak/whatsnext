import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getCollection, getMovieCollectionId } from '../services/tmdb';

// movieId -> collectionId (0 = belongs to none), remembered on the device so
// the lookup for a given movie is paid for once, not on every visit to Home.
const CACHE_KEY = 'whatsnext_movie_collections';
// How many of the most recently watched movies to consider.
const LOOKBACK = 8;

const readCache = () => {
    try {
        const map = JSON.parse(localStorage.getItem(CACHE_KEY));
        return map && typeof map === 'object' ? map : {};
    } catch {
        return {};
    }
};

/**
 * The franchise the viewer is part-way through: the collection of the most
 * recently watched movie that belongs to one and still has films left, with how
 * many of its films they have seen. Null when there isn't one (no watched
 * movies, none in a collection, or everything finished).
 *
 * Returns { name, watched, total, nextId } | null.
 */
export const useFranchiseProgress = () => {
    const { watched } = useUser();
    const [progress, setProgress] = useState(null);

    const watchedMovieIds = watched.filter((m) => (m.type || 'movie') === 'movie').map((m) => m.id);
    const key = watchedMovieIds.join(',');

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (watchedMovieIds.length === 0) {
                setProgress(null);
                return;
            }
            const cache = readCache();
            // Saved order is oldest first, so walk it from the end.
            const recent = watchedMovieIds.slice(-LOOKBACK).reverse();
            const seen = new Set(watchedMovieIds);
            const tried = new Set();

            for (const movieId of recent) {
                let collectionId = cache[movieId];
                if (collectionId === undefined) {
                    const found = await getMovieCollectionId(movieId);
                    if (!active) return;
                    // The lookup failed: try this movie again on a later visit
                    // rather than recording it as belonging to no franchise.
                    if (found === undefined) continue;
                    collectionId = found || 0;
                    cache[movieId] = collectionId;
                    try {
                        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
                    } catch {
                        // Storage full or blocked: the lookup just isn't remembered.
                    }
                }
                if (!collectionId || tried.has(collectionId)) continue;
                tried.add(collectionId);

                const collection = await getCollection(collectionId);
                if (!active) return;
                const parts = collection?.parts || [];
                if (parts.length < 2) continue;
                const watchedCount = parts.filter((p) => seen.has(p.id)).length;
                if (watchedCount >= parts.length) continue;

                setProgress({
                    name: collection.name,
                    watched: watchedCount,
                    total: parts.length,
                    // The first film in watch order they haven't seen yet.
                    nextId: parts.find((p) => !seen.has(p.id))?.id || parts[0].id,
                });
                return;
            }
            setProgress(null);
        };

        load().catch(() => {
            if (active) setProgress(null);
        });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return progress;
};
