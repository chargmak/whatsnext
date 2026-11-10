import { getCollection, getMovieCollectionId } from './tmdb';

// movieId -> collectionId (0 = belongs to none), remembered on the device so
// the lookup for a given movie is paid for once, not on every visit.
const CACHE_KEY = 'whatsnext_movie_collections';
// How many TMDB lookups to have in flight at once.
const BATCH = 6;

const readCache = () => {
    try {
        const map = JSON.parse(localStorage.getItem(CACHE_KEY));
        return map && typeof map === 'object' ? map : {};
    } catch {
        return {};
    }
};

const writeCache = (map) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch {
        // Storage full or blocked: the lookups just aren't remembered.
    }
};

/**
 * Which collection each of these movies belongs to. Returns a Map of
 * movieId -> collectionId for the ones that belong to one; movies in no
 * collection, and movies whose lookup failed, are simply absent (a failure is
 * not remembered, so it is retried next time). `isActive` lets a caller that
 * has gone away stop the work between batches.
 */
export const resolveCollectionIds = async (movieIds, isActive = () => true) => {
    const cache = readCache();
    const missing = movieIds.filter((id) => cache[id] === undefined);

    for (let i = 0; i < missing.length && isActive(); i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        const found = await Promise.all(batch.map((id) => getMovieCollectionId(id)));
        batch.forEach((id, n) => {
            // undefined = the lookup itself failed; leave it uncached.
            if (found[n] !== undefined) cache[id] = found[n] || 0;
        });
        writeCache(cache);
    }

    const out = new Map();
    movieIds.forEach((id) => {
        if (cache[id]) out.set(id, cache[id]);
    });
    return out;
};

/**
 * A collection with the viewer's progress through it, or null when it isn't a
 * real franchise (fewer than two films) or couldn't be loaded. Films are in
 * release order, which is the order to watch them in.
 */
export const loadFranchise = async (collectionId, seenIds) => {
    const collection = await getCollection(collectionId);
    const parts = collection?.parts || [];
    if (parts.length < 2) return null;

    const films = parts.map((p) => ({ ...p, watched: seenIds.has(p.id) }));
    const watched = films.filter((f) => f.watched).length;
    return {
        id: collection.id,
        name: collection.name,
        poster: collection.poster,
        films,
        watched,
        total: films.length,
        complete: watched >= films.length,
        // The first film in watch order they haven't seen yet.
        next: films.find((f) => !f.watched) || null,
    };
};

export const loadFranchises = async (collectionIds, seenIds, isActive = () => true) => {
    const out = [];
    for (let i = 0; i < collectionIds.length && isActive(); i += BATCH) {
        const batch = await Promise.all(
            collectionIds.slice(i, i + BATCH).map((id) => loadFranchise(id, seenIds).catch(() => null))
        );
        out.push(...batch.filter(Boolean));
    }
    return out;
};
