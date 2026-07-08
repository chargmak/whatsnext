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

export const fetchAllUserData = async (userId) => {
    const [wl, hist, eps, rems] = await Promise.all([
        supabase.from('watchlists').select('*').eq('user_id', userId).order('added_at', { ascending: true }),
        supabase.from('history').select('*').eq('user_id', userId).order('watched_at', { ascending: true }),
        supabase.from('watched_episodes').select('tv_id,season_number,episode_number').eq('user_id', userId),
        supabase.from('reminders').select('*').eq('user_id', userId).order('release_date', { ascending: true }),
    ]);

    const episodes = {};
    (orThrow(eps) || []).forEach((row) => {
        const tv = String(row.tv_id);
        const season = String(row.season_number);
        if (!episodes[tv]) episodes[tv] = {};
        if (!episodes[tv][season]) episodes[tv][season] = [];
        episodes[tv][season].push(row.episode_number);
    });

    return {
        watchlist: (orThrow(wl) || []).map(fromDbRow),
        watched: (orThrow(hist) || []).map(fromDbRow),
        episodes,
        reminders: (orThrow(rems) || []).map(fromReminderRow),
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

export const setEpisodeWatched = async (userId, tvId, seasonNumber, episodeNumber, watched) => {
    const key = {
        user_id: userId,
        tv_id: Number(tvId),
        season_number: Number(seasonNumber),
        episode_number: Number(episodeNumber),
    };
    if (watched) {
        const { error } = await supabase.from('watched_episodes').insert(key);
        if (error && error.code !== '23505') throw error; // 23505: already marked, fine
    } else {
        orThrow(await supabase.from('watched_episodes').delete().match(key));
    }
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
                .upsert(batch, { onConflict: 'user_id,tv_id,season_number,episode_number' });
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
        orThrow(await supabase.from('watched_episodes')
            .upsert(batch, { onConflict: 'user_id,tv_id,season_number,episode_number' }));
    }

    for (const rem of reminders) {
        await addReminder(userId, rem);
    }
};
