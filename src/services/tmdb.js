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


// Unified Data Mapper
export const mapMediaData = (item) => {
    if (!item) return null;
    const isTv = item.media_type === 'tv' || item.type === 'tv' || item.first_air_date; // Robust check

    return {
        id: item.id,
        type: isTv ? 'tv' : 'movie',
        title: item.title || item.name,
        poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image',
        backdrop: item.backdrop_path ? `${BACKDROP_BASE_URL}${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date)?.split('-')[0] || 'N/A',
        plot: item.overview,
        genres: item.genres?.map(g => g.name) || [],
        // TV Specific
        episodes: item.number_of_episodes,
        seasons: item.number_of_seasons,
        // Movie Specific
        runtime: item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : null,

        upcoming: new Date(item.release_date) > new Date(),
        releaseDate: item.release_date || item.first_air_date
    };
};

// Get TV Season Details with Episodes
export const getTVSeasonDetails = async (tvId, seasonNumber) => {
    return await fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
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
