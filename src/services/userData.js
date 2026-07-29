import { supabase } from './supabase';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const PLACEHOLDER_POSTER = 'https://via.placeholder.com/500x750?text=No+Image';

// Only the fields the list/calendar UIs need are persisted; bulky detail data
// (credits, streaming, trailerKey) is refetched from TMDB on the detail page.
const sanitizeItem = (movie) => ({
    id: movie.id,
    type: movie.type || 'movie',
    title: movie.title || 'Untitled',
    poster: movie.poster ?? null,
    backdrop: movie.backdrop ?? null,
    rating: movie.rating ?? null,
    year: movie.year ?? null,
    plot: movie.plot ?? null,
    genres: movie.genres ?? [],
    episodes: movie.episodes ?? null,
    seasons: movie.seasons ?? null,
    runtime: movie.runtime ?? null,
    upcoming: movie.upcoming ?? false,
    releaseDate: movie.releaseDate ?? null,
});

const extractPosterPath = (poster) =>
    typeof poster === 'string' && poster.startsWith(IMAGE_BASE_URL)
        ? poster.slice(IMAGE_BASE_URL.length)
        : null;

const toDbRow = (userId, movie) => ({
    user_id: userId,
    movie_id: movie.id,
    media_type: movie.type || 'movie',
    title: movie.title || 'Untitled',
    poster_path: extractPosterPath(movie.poster),
    vote_average: Number.parseFloat(movie.rating) || null,
    payload: sanitizeItem(movie),
});

// Rows written before the payload column existed still render: poster/rating
// are rebuilt from the typed columns.
export const fromDbRow = (row) => {
    const payload = row.payload || {};
    return {
        ...payload,
        id: row.movie_id,
        type: row.media_type,
        title: row.title,
        poster: payload.poster || (row.poster_path ? `${IMAGE_BASE_URL}${row.poster_path}` : PLACEHOLDER_POSTER),
        rating: payload.rating || (row.vote_average != null ? Number(row.vote_average).toFixed(1) : 'N/A'),
        genres: payload.genres || [],
    };
};

const fromReminderRow = (row) => ({
    id: row.movie_id,
    type: row.media_type,
    title: row.title,
    poster: row.poster_path ? `${IMAGE_BASE_URL}${row.poster_path}` : PLACEHOLDER_POSTER,
    releaseDate: row.release_date,
});

const orThrow = ({ data, error }) => {
    if (error) throw error;
    return data;
};

// PostgREST caps every response at the project's `max-rows` setting (1000 on
// Supabase by default) and truncates silently — no error, just a short array.
// An unpaged select is therefore a data-loss bug the moment a library passes
// 1000 rows: the surplus reads back as "never watched", so episodes marked in
// the app reappear as unwatched on the next load. Always page.
const PAGE_SIZE = 1000;

const fetchAllRows = async (table, columns, userId, orderBy) => {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase.from(table).select(columns).eq('user_id', userId);
        if (orderBy) query = query.order(orderBy, { ascending: true });
        // The primary key breaks ties in the sort. Without it rows that compare
        // equal can shuffle between requests, so paging would drop or duplicate
        // them — exactly the corruption the paging is here to prevent.
        const { data, error } = await query
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        // A short page means the server had nothing more to give.
        if (!data || data.length < PAGE_SIZE) return rows;
    }
};

export const fetchAllUserData = async (userId) => {
    const [wl, hist, eps, rems] = await Promise.all([
        fetchAllRows('watchlists', '*', userId, 'added_at'),
        fetchAllRows('history', '*', userId, 'watched_at'),
        fetchAllRows('watched_episodes', 'tv_id,season_number,episode_number', userId),
        fetchAllRows('reminders', '*', userId, 'release_date'),
    ]);

    const episodes = {};
    eps.forEach((row) => {
        const tv = String(row.tv_id);
        const season = String(row.season_number);
        if (!episodes[tv]) episodes[tv] = {};
        if (!episodes[tv][season]) episodes[tv][season] = [];
        episodes[tv][season].push(row.episode_number);
    });

    return {
        watchlist: wl.map(fromDbRow),
        watched: hist.map(fromDbRow),
        episodes,
        reminders: rems.map(fromReminderRow),
    };
};

export const upsertWatchlistItem = async (userId, movie) => {
    orThrow(await supabase.from('watchlists')
        .upsert(toDbRow(userId, movie), { onConflict: 'user_id,movie_id,media_type' }));
};

export const deleteWatchlistItem = async (userId, movieId, mediaType) => {
    orThrow(await supabase.from('watchlists')
        .delete().match({ user_id: userId, movie_id: movieId, media_type: mediaType }));
};

export const upsertHistoryItem = async (userId, movie) => {
    orThrow(await supabase.from('history')
        .upsert(toDbRow(userId, movie), { onConflict: 'user_id,movie_id,media_type' }));
};

export const deleteHistoryItem = async (userId, movieId, mediaType) => {
    orThrow(await supabase.from('history')
        .delete().match({ user_id: userId, movie_id: movieId, media_type: mediaType }));
};

// A watched_episodes row is a bare marker — the key *is* the whole record — so
// there is never anything to update on conflict. `ignoreDuplicates` makes this
// ON CONFLICT DO NOTHING; the DO UPDATE form would additionally require an
// UPDATE row-level-security policy, and re-marking a season that already had
// one episode ticked would fail outright.
const EPISODE_UPSERT = {
    onConflict: 'user_id,tv_id,season_number,episode_number',
    ignoreDuplicates: true,
};

export const setSeasonEpisodesWatched = async (userId, tvId, seasonNumber, episodeNumbers, watched) => {
    if (!episodeNumbers.length) return;
    if (watched) {
        const rows = episodeNumbers.map((episodeNumber) => ({
            user_id: userId,
            tv_id: Number(tvId),
            season_number: Number(seasonNumber),
            episode_number: Number(episodeNumber),
        }));
        for (const batch of chunk(rows, 200)) {
            const { error } = await supabase.from('watched_episodes')
                .upsert(batch, EPISODE_UPSERT);
            if (error) throw error;
        }
    } else {
        orThrow(await supabase.from('watched_episodes').delete().match({
            user_id: userId,
            tv_id: Number(tvId),
            season_number: Number(seasonNumber),
        }).in('episode_number', episodeNumbers.map(Number)));
    }
};

export const addReminder = async (userId, entry) => {
    orThrow(await supabase.from('reminders').upsert({
        user_id: userId,
        movie_id: entry.id,
        media_type: entry.type || 'movie',
        title: entry.title || 'Untitled',
        poster_path: extractPosterPath(entry.poster),
        release_date: entry.releaseDate || null,
    }, { onConflict: 'user_id,movie_id,media_type' }));
};

export const removeReminder = async (userId, movieId, mediaType) => {
    orThrow(await supabase.from('reminders')
        .delete().match({ user_id: userId, movie_id: movieId, media_type: mediaType }));
};

export const fetchProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
};

export const updateProfile = async (userId, fields) => {
    orThrow(await supabase.from('profiles').upsert({
        id: userId,
        ...fields,
        updated_at: new Date().toISOString(),
    }));
};

export const clearAllUserData = async (userId) => {
    for (const table of ['watchlists', 'history', 'watched_episodes', 'reminders']) {
        orThrow(await supabase.from(table).delete().eq('user_id', userId));
    }
};

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// One-time import of guest/localStorage data into a freshly signed-in account.
export const migrateLocalData = async (userId, { watchlist = [], watched = [], episodes = {}, reminders = [] }) => {
    for (const batch of chunk(watchlist.map((m) => toDbRow(userId, m)), 100)) {
        orThrow(await supabase.from('watchlists').upsert(batch, { onConflict: 'user_id,movie_id,media_type' }));
    }
    for (const batch of chunk(watched.map((m) => toDbRow(userId, m)), 100)) {
        orThrow(await supabase.from('history').upsert(batch, { onConflict: 'user_id,movie_id,media_type' }));
    }

    const episodeRows = [];
    Object.entries(episodes).forEach(([tvId, seasons]) => {
        Object.entries(seasons).forEach(([season, eps]) => {
            eps.forEach((ep) => episodeRows.push({
                user_id: userId,
                tv_id: Number(tvId),
                season_number: Number(season),
                episode_number: Number(ep),
            }));
        });
    });
    for (const batch of chunk(episodeRows, 200)) {
        orThrow(await supabase.from('watched_episodes').upsert(batch, EPISODE_UPSERT));
    }

    for (const rem of reminders) {
        await addReminder(userId, rem);
    }
};
