import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../context/UserContext';
import { loadFranchise, loadFranchises, resolveCollectionIds } from '../services/franchises';

// How many of the most recently watched movies the Home tile considers.
const LOOKBACK = 8;

const movieIdsOf = (list) => list.filter((m) => (m.type || 'movie') === 'movie').map((m) => m.id);

/**
 * The franchise the viewer is part-way through: the collection of the most
 * recently watched movie that belongs to one and still has films left. Null
 * when there isn't one (no watched movies, none in a collection, or everything
 * finished). Looks only at recent history so Home stays cheap; the Franchises
 * page uses useFranchises for the full picture.
 *
 * Returns { name, watched, total, nextId } | null.
 */
export const useFranchiseProgress = () => {
    const { watched } = useUser();
    const [progress, setProgress] = useState(null);

    const watchedMovieIds = useMemo(() => movieIdsOf(watched), [watched]);
    const key = watchedMovieIds.join(',');

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (watchedMovieIds.length === 0) {
                setProgress(null);
                return;
            }
            // Saved order is oldest first, so walk it from the end.
            const recent = watchedMovieIds.slice(-LOOKBACK).reverse();
            const seen = new Set(watchedMovieIds);
            const byMovie = await resolveCollectionIds(recent, () => active);
            if (!active) return;

            const tried = new Set();
            for (const movieId of recent) {
                const collectionId = byMovie.get(movieId);
                if (!collectionId || tried.has(collectionId)) continue;
                tried.add(collectionId);

                const franchise = await loadFranchise(collectionId, seen);
                if (!active) return;
                if (!franchise || franchise.complete) continue;

                setProgress({
                    name: franchise.name,
                    watched: franchise.watched,
                    total: franchise.total,
                    nextId: franchise.next?.id || franchise.films[0].id,
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

// In progress first (closest to done at the top), then the ones saved but not
// started, then the finished ones.
const rank = (f) => (f.complete ? 2 : f.watched > 0 ? 0 : 1);
const byProgress = (a, b) =>
    rank(a) - rank(b)
    || (b.watched / b.total) - (a.watched / a.total)
    || a.name.localeCompare(b.name);

/**
 * Every franchise the viewer has touched — any collection containing a movie
 * they have watched or saved — with their progress through each.
 *
 * Returns { loading, franchises }.
 */
export const useFranchises = () => {
    const { watched, watchlist } = useUser();
    const [state, setState] = useState({ key: null, franchises: [] });

    const watchedIds = useMemo(() => movieIdsOf(watched), [watched]);
    const savedIds = useMemo(() => movieIdsOf(watchlist), [watchlist]);
    // Which collections are involved only changes when a movie enters or leaves
    // the two lists; ticking a film inside a known collection is recomputed
    // below from what is already loaded, without refetching.
    const membersKey = [...new Set([...watchedIds, ...savedIds])].sort((a, b) => a - b).join(',');

    useEffect(() => {
        let active = true;
        const load = async () => {
            const ids = membersKey ? membersKey.split(',').map(Number) : [];
            const byMovie = await resolveCollectionIds(ids, () => active);
            if (!active) return;
            const collectionIds = [...new Set(byMovie.values())];
            const loaded = await loadFranchises(collectionIds, new Set(), () => active);
            if (!active) return;
            setState({ key: membersKey, franchises: loaded });
        };
        load().catch(() => {
            if (active) setState({ key: membersKey, franchises: [] });
        });
        return () => { active = false; };
    }, [membersKey]);

    const franchises = useMemo(() => {
        const seen = new Set(watchedIds);
        return state.franchises
            .map((f) => {
                const films = f.films.map((film) => ({ ...film, watched: seen.has(film.id) }));
                const count = films.filter((film) => film.watched).length;
                return {
                    ...f,
                    films,
                    watched: count,
                    complete: count >= films.length,
                    next: films.find((film) => !film.watched) || null,
                };
            })
            .sort(byProgress);
    }, [state.franchises, watchedIds]);

    // Only the very first load shows a loading state; later membership changes
    // keep the current list on screen while the new one resolves.
    return { loading: state.key === null, franchises };
};
