const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";

// Build a TMDB image URL for an arbitrary path/size, or a placeholder.
export const imageUrl = (path, size = 'w500', fallback = 'https://via.placeholder.com/500x750?text=No+Image') =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : fallback;

// Helper to handle responses
const fetchFromTMDB = async (endpoint, params = {}) => {
    if (!API_KEY) {
        console.warn("TMDB API Key is missing.");
        return null;
    }

    const queryParams = new URLSearchParams({
        api_key: API_KEY,
        language: 'en-US',
        ...params
    });

    try {
        const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);
        if (!response.ok) throw new Error('API Request Failed');
        return await response.json();
    } catch (error) {
        console.error("TMDB API Error:", error);
        return null;
    }
};

export const getTrendingMovies = async () => {
    return await fetchFromTMDB('/trending/movie/week');
};

export const getTrendingTV = async () => {
    return await fetchFromTMDB('/trending/tv/week');
};

export const searchMulti = async (query) => {
    return await fetchFromTMDB('/search/multi', { query });
};

// TMDB's "more like this" list for a single title.
const getTitleRecommendations = async (id, type) => {
    const endpoint = type === 'tv' ? `/tv/${id}/recommendations` : `/movie/${id}/recommendations`;
    const data = await fetchFromTMDB(endpoint);
    return data?.results || [];
};

// Build a personalized "recommended for you" row from the titles a user has
// saved. `seeds` are their saved items (already filtered to one media type);
// `excludeIds` keeps titles they've already saved or watched out of the result.
// Candidates are ranked by how many of the user's titles recommend them, so the
// picks lean toward their overall taste rather than any single title.
export const getRecommendationsFromSeeds = async (seeds, type, excludeIds = new Set(), limit = 12) => {
    const validSeeds = (seeds || []).filter((s) => s && s.id);
    if (!validSeeds.length) return [];

    // Cap the number of requests; the most recently saved titles are the
    // strongest signal, so sample from the end of the list.
    const sampled = validSeeds.slice(-8);
    const lists = await Promise.all(sampled.map((s) => getTitleRecommendations(s.id, type)));

    const scored = new Map();
    lists.flat().forEach((item) => {
        if (!item || !item.poster_path) return;
        if (excludeIds.has(item.id)) return;
        const entry = scored.get(item.id);
        if (entry) {
            entry.score += 1;
        } else {
            scored.set(item.id, { item: { ...item, media_type: type }, score: 1 });
        }
    });

    return Array.from(scored.values())
        .sort((a, b) => b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0))
        .slice(0, limit)
        .map((entry) => mapMediaData(entry.item));
};

// How hard one veto pulls a shared-genre candidate down. Tuned to nudge, not
// bury: a candidate typically scores 2–5, so a single overlapping dislike costs
// half a point while several dismissals in the same genre compound.
const DISLIKE_PENALTY = 0.5;

// How much a candidate overlaps the user's vetoed genres: the summed veto count
// across every genre the candidate carries. `dislikedGenres` is a genre-name →
// count tally (empty/null for users who've never hit "Not for me", making this
// a no-op). List payloads expose only genre_ids, so map them back to names.
const genreDislikeScore = (item, dislikedGenres) => {
    if (!dislikedGenres) return 0;
    return (item.genre_ids || []).reduce(
        (sum, id) => sum + (dislikedGenres[GENRE_NAMES_BY_ID[id]] || 0),
        0,
    );
};

// Build the "What's Next?" spotlight queue: one-at-a-time picks seeded from the
// user's watch history. Differs from getRecommendationsFromSeeds in three ways:
// hits are recency-weighted (a rec from last night's watch counts more than one
// from months ago), each pick remembers which seed produced it (`becauseOf`, for
// the "Because you watched X" line), and a short queue is padded with trending
// titles so brand-new users still get proposals. Returns mapped items extended
// with { becauseOf, match, source }. `dislikedGenres` sinks titles whose genres
// match what the user has vetoed.
export const getSpotlightQueue = async ({ seeds, type, excludeIds = new Set(), dislikedGenres = null, limit = 20 }) => {
    const validSeeds = (seeds || []).filter((s) => s && s.id);
    // Most recently watched titles are the strongest signal → sample the end.
    const sampled = validSeeds.slice(-8);
    const picks = [];

    if (sampled.length) {
        const lists = await Promise.all(sampled.map((s) => getTitleRecommendations(s.id, type)));
        const scored = new Map();
        lists.forEach((list, i) => {
            const recency = (i + 1) / lists.length; // 1.0 = newest seed
            list.forEach((item) => {
                if (!item || !item.poster_path) return;
                if (excludeIds.has(item.id)) return;
                let entry = scored.get(item.id);
                if (!entry) {
                    entry = { raw: item, score: 0, becauseOf: null, becauseOfWeight: -1 };
                    scored.set(item.id, entry);
                }
                entry.score += 1 + recency;
                // Credit the pick to the most recent seed that recommends it.
                if (recency > entry.becauseOfWeight) {
                    entry.becauseOf = sampled[i].title;
                    entry.becauseOfWeight = recency;
                }
            });
        });
        // Sink candidates whose genres overlap what the user vetoed ("Not for
        // me"), so a dismissal shapes the ranking without hard-filtering a whole
        // genre. Match % follows the adjusted score, so a sunk pick reads lower.
        const ranked = Array.from(scored.values())
            .map((entry) => ({
                ...entry,
                adjScore: Math.max(0.1, entry.score - DISLIKE_PENALTY * genreDislikeScore(entry.raw, dislikedGenres)),
            }))
            .sort((a, b) => b.adjScore - a.adjScore || (b.raw.popularity || 0) - (a.raw.popularity || 0));
        const maxScore = ranked[0]?.adjScore || 1;
        ranked.slice(0, limit).forEach((entry) => picks.push({
            ...mapMediaData({ ...entry.raw, media_type: type }),
            // w1280 is plenty for a hero card and far lighter than `original`.
            backdrop: entry.raw.backdrop_path ? imageUrl(entry.raw.backdrop_path, 'w1280', null) : null,
            becauseOf: entry.becauseOf,
            match: Math.min(98, Math.round(60 + 38 * (entry.adjScore / maxScore))),
            source: 'history',
        }));
    }

    // Cold start (or nearly-exhausted taste graph): pad with trending titles of
    // the same type. No becauseOf/match — we don't fake personalization.
    if (picks.length < Math.min(limit, 6)) {
        const data = type === 'tv' ? await getTrendingTV() : await getTrendingMovies();
        const have = new Set(picks.map((p) => p.id));
        (data?.results || [])
            .filter((r) => r.poster_path && !excludeIds.has(r.id) && !have.has(r.id))
            // Vetoed genres sink here too, so cold-start fillers respect "Not for
            // me". Stable sort keeps trending order among equally-liked titles.
            .sort((a, b) => genreDislikeScore(a, dislikedGenres) - genreDislikeScore(b, dislikedGenres))
            .slice(0, limit - picks.length)
            .forEach((r) => picks.push({
                ...mapMediaData({ ...r, media_type: type }),
                backdrop: r.backdrop_path ? imageUrl(r.backdrop_path, 'w1280', null) : null,
                becauseOf: null,
                match: null,
                source: 'trending',
            }));
    }

    return picks;
};

// The extra data the spotlight card shows for the pick currently on screen:
// streaming providers (for the viewer's country) and a playable trailer. Kept
// separate from getDetails — that's 4 fetches; the spotlight only needs these 2,
// requested lazily per shown card.
export const getSpotlightExtras = async (id, type, country = 'US') => {
    const endpoint = type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
    const [providers, videos] = await Promise.all([
        fetchFromTMDB(`${endpoint}/watch/providers`),
        fetchFromTMDB(`${endpoint}/videos`),
    ]);

    const trailer = videos?.results?.find(
        vid => vid.site === 'YouTube' && vid.type === 'Trailer'
    ) || videos?.results?.find(vid => vid.site === 'YouTube');

    const countryProviders = providers?.results?.[country] || providers?.results?.US || {};
    return {
        providers: (countryProviders.flatrate || []).map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logo: imageUrl(p.logo_path, 'w92', null),
        })).filter((p) => p.logo),
        trailerKey: trailer?.key || null,
    };
};


export const getDetails = async (id, type, country = 'US') => {
    const endpoint = type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
    const [details, credits, providers, videos] = await Promise.all([
        fetchFromTMDB(endpoint),
        fetchFromTMDB(`${endpoint}/credits`),
        fetchFromTMDB(`${endpoint}/watch/providers`),
        fetchFromTMDB(`${endpoint}/videos`)
    ]);

    if (!details) return null;

    // Find the best trailer (YouTube, Type='Trailer')
    const trailer = videos?.results?.find(
        vid => vid.site === 'YouTube' && vid.type === 'Trailer'
    ) || videos?.results?.find(vid => vid.site === 'YouTube'); // Fallback to any YT video

    // Use user's country for providers, fallback to US if not available
    const userCountryProviders = providers?.results?.[country] || providers?.results?.US || {};

    return {
        ...details,
        credits: credits?.cast?.slice(0, 10) || [],
        providers: userCountryProviders,
        trailerKey: trailer?.key || null
    };
};


// TMDB genre ids → display names, movie and TV lists combined (their ids don't
// collide). List payloads (/trending, /recommendations, /discover) only carry
// `genre_ids`, unlike detail payloads which carry full genre objects — this map
// lets mapMediaData produce names for both.
const GENRE_NAMES_BY_ID = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    53: 'Thriller', 10752: 'War', 37: 'Western', 10770: 'TV Movie',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
    10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

// Unified Data Mapper
export const mapMediaData = (item) => {
    if (!item) return null;
    const isTv = item.media_type === 'tv' || item.type === 'tv' || item.first_air_date; // Robust check
    // TV payloads carry first_air_date, movies release_date — pick whichever
    // exists so `upcoming` and `releaseDate` work for both (and never build an
    // Invalid Date from an undefined value).
    const releaseDate = item.release_date || item.first_air_date || null;

    return {
        id: item.id,
        type: isTv ? 'tv' : 'movie',
        title: item.title || item.name,
        poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image',
        backdrop: item.backdrop_path ? `${BACKDROP_BASE_URL}${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date)?.split('-')[0] || 'N/A',
        plot: item.overview,
        genres: item.genres?.map(g => g.name)
            || item.genre_ids?.map((id) => GENRE_NAMES_BY_ID[id]).filter(Boolean)
            || [],
        // TV Specific
        episodes: item.number_of_episodes,
        seasons: item.number_of_seasons,
        // Movie Specific
        runtime: item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : null,

        upcoming: releaseDate ? new Date(releaseDate) > new Date() : false,
        releaseDate
    };
};

// Get TV Season Details with Episodes
export const getTVSeasonDetails = async (tvId, seasonNumber) => {
    return await fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
};

// Fetch the minimal series info the Library needs to decide whether a show is
// "completed": mapped card data plus the airing status and per-season episode
// counts (specials / season 0 excluded, since they aren't part of the main run).
export const getTVWatchStatus = async (tvId) => {
    const details = await fetchFromTMDB(`/tv/${tvId}`);
    if (!details) return null;

    const seasonEpisodeCounts = {};
    (details.seasons || []).forEach((season) => {
        if (season.season_number !== 0 && season.episode_count > 0) {
            seasonEpisodeCounts[season.season_number] = season.episode_count;
        }
    });

    return {
        ...mapMediaData({ ...details, media_type: 'tv' }),
        // "Ended" or "Canceled" means no further episodes are coming.
        status: details.status,
        ended: details.status === 'Ended' || details.status === 'Canceled',
        seasonEpisodeCounts,
    };
};

// Find the next episode a viewer should watch for a series: the earliest
// already-aired episode they haven't marked as watched. Seasons are walked in
// order; a fully-watched season is skipped without a request, and within a
// season scanning stops at the first episode that hasn't aired yet (nothing
// past it is available). `watchedForShow` is the per-show map the app stores:
// { [seasonNumber]: [episodeNumbers] }. Returns null when the viewer is caught
// up (no aired, unseen episode) — including shows they've finished or not
// started but whose next episode hasn't aired.
export const getNextUnwatchedEpisode = async (tvId, watchedForShow = {}) => {
    const details = await fetchFromTMDB(`/tv/${tvId}`);
    if (!details) return null;

    const now = new Date();
    const seasons = (details.seasons || [])
        .filter((s) => s.season_number !== 0 && s.episode_count > 0)
        .sort((a, b) => a.season_number - b.season_number);

    for (const season of seasons) {
        const seasonNumber = season.season_number;
        const watchedSet = watchedForShow[String(seasonNumber)] || [];
        // Whole season already seen — no need to spend a request on it.
        if (watchedSet.length >= season.episode_count) continue;

        const seasonData = await fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
        const episodes = seasonData?.episodes || [];

        for (const ep of episodes) {
            const aired = ep.air_date && new Date(ep.air_date) <= now;
            // Episodes air in order, so nothing beyond an unaired one is
            // available yet — the viewer is caught up on what exists.
            if (!aired) return null;
            if (watchedSet.includes(ep.episode_number)) continue;

            return {
                id: details.id,
                type: 'tv',
                title: details.name,
                poster: details.poster_path ? `${IMAGE_BASE_URL}${details.poster_path}` : null,
                seasonNumber,
                episodeNumber: ep.episode_number,
                episodeName: ep.name,
                still: ep.still_path ? `${BACKDROP_BASE_URL}${ep.still_path}` : null,
                airDate: ep.air_date,
                overview: ep.overview,
                totalSeasons: seasons.length,
            };
        }
        // Every episode this season is aired-and-watched; keep looking in the
        // next season rather than declaring the viewer caught up.
    }
    return null;
};

// Get TV Series with upcoming episodes
export const getTVSeriesWithEpisodes = async (tvId) => {
    const details = await fetchFromTMDB(`/tv/${tvId}`);
    if (!details) return null;

    // Get current season details if available
    if (details.next_episode_to_air) {
        return {
            ...details,
            nextEpisode: details.next_episode_to_air
        };
    }

    return details;
};

// Genre name to ID mapping
const GENRE_MAP = {
    'Action': 28,
    'Adventure': 12,
    'Animation': 16,
    'Comedy': 35,
    'Crime': 80,
    'Documentary': 99,
    'Drama': 18,
    'Family': 10751,
    'Fantasy': 14,
    'History': 36,
    'Horror': 27,
    'Music': 10402,
    'Mystery': 9648,
    'Romance': 10749,
    'Sci-Fi': 878,
    'Thriller': 53,
    'War': 10752,
    'Western': 37
};

// Discover movies and TV shows by genre
export const discoverByGenre = async (genreName) => {
    const genreId = GENRE_MAP[genreName];
    if (!genreId) return { results: [] };

    // Fetch both movies and TV shows with this genre
    const [movies, tvShows] = await Promise.all([
        fetchFromTMDB('/discover/movie', {
            with_genres: genreId,
            sort_by: 'popularity.desc'
        }),
        fetchFromTMDB('/discover/tv', {
            with_genres: genreId,
            sort_by: 'popularity.desc'
        })
    ]);

    // Combine and mark media types
    const movieResults = (movies?.results || []).map(item => ({ ...item, media_type: 'movie' }));
    const tvResults = (tvShows?.results || []).map(item => ({ ...item, media_type: 'tv' }));

    // Interleave movies and TV shows for variety
    const combined = [];
    const maxLength = Math.max(movieResults.length, tvResults.length);
    for (let i = 0; i < maxLength; i++) {
        if (movieResults[i]) combined.push(movieResults[i]);
        if (tvResults[i]) combined.push(tvResults[i]);
    }

    return { results: combined.slice(0, 20) }; // Limit to 20 results
};

// --- People (completionist / person pages) ---

// TV genres that are noise for a "filmography" (talk / news / reality).
const NON_FILM_TV_GENRES = new Set([10767, 10763, 10764]);

export const getPersonDetails = async (personId) => {
    return await fetchFromTMDB(`/person/${personId}`);
};

// Normalize one entry from /person/{id}/combined_credits into the app shape.
export const mapPersonCredit = (item) => {
    const isTv = item.media_type === 'tv';
    return {
        id: item.id,
        type: isTv ? 'tv' : 'movie',
        title: item.title || item.name,
        poster: imageUrl(item.poster_path, 'w500'),
        posterPath: item.poster_path || null,
        year: (item.release_date || item.first_air_date)?.split('-')[0] || '',
        releaseDate: item.release_date || item.first_air_date || null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        popularity: item.popularity || 0,
        voteCount: item.vote_count || 0,
        genreIds: item.genre_ids || [],
        character: item.character || null,
        job: item.job || null,
        department: item.department || null,
    };
};

// A person's notable, watch-trackable filmography (cast + directing/writing crew),
// de-duped, cleaned of talk/news/reality, and sorted by popularity.
export const getPersonCredits = async (personId) => {
    const data = await fetchFromTMDB(`/person/${personId}/combined_credits`);
    if (!data) return { cast: [], crew: [] };

    const clean = (list) => {
        const seen = new Set();
        return (list || [])
            .filter((c) => (c.media_type === 'movie' || c.media_type === 'tv') && c.poster_path)
            .filter((c) => !(c.genre_ids || []).some((g) => NON_FILM_TV_GENRES.has(g)))
            .map(mapPersonCredit)
            .filter((c) => {
                const key = `${c.type}-${c.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => b.popularity - a.popularity);
    };

    // Only surface meaningful crew roles (directors, writers, creators).
    const keyJobs = new Set(['Director', 'Writer', 'Screenplay', 'Creator', 'Executive Producer']);
    const crew = clean((data.crew || []).filter((c) => keyJobs.has(c.job)));

    return { cast: clean(data.cast), crew };
};

// --- Franchises / collections (belongs_to_collection) ---

export const getCollection = async (collectionId) => {
    const data = await fetchFromTMDB(`/collection/${collectionId}`);
    if (!data) return null;
    const parts = (data.parts || [])
        .map((p) => mapPersonCredit({ ...p, media_type: 'movie' }))
        .sort((a, b) => {
            if (!a.releaseDate) return 1;
            if (!b.releaseDate) return -1;
            return a.releaseDate.localeCompare(b.releaseDate); // chronological watch order
        });
    return {
        id: data.id,
        name: data.name,
        overview: data.overview,
        poster: imageUrl(data.poster_path, 'w500'),
        backdrop: data.backdrop_path ? `${BACKDROP_BASE_URL}${data.backdrop_path}` : null,
        parts,
    };
};
