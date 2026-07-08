// Server-side TMDB helpers for the CineBot Edge Function.
// (The browser client lives in src/services/tmdb.js — this is a Deno copy so the
// TMDB key stays server-side and is read from Deno.env, never the bundle.)

const BASE_URL = 'https://api.themoviedb.org/3';

const GENRE_MAP: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878,
  Thriller: 53, War: 10752, Western: 37,
};

const key = () => Deno.env.get('TMDB_API_KEY') ?? '';

async function tmdb(endpoint: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ api_key: key(), language: 'en-US', ...params });
  const res = await fetch(`${BASE_URL}${endpoint}?${qs}`);
  if (!res.ok) return null;
  return res.json();
}

const shape = (item: any) => ({
  id: item.id,
  type: item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie',
  title: item.title || item.name,
  year: (item.release_date || item.first_air_date)?.split('-')[0] || '',
  rating: item.vote_average ? Number(item.vote_average).toFixed(1) : 'N/A',
  overview: (item.overview || '').slice(0, 200),
});

export async function searchTmdb(query: string) {
  const data = await tmdb('/search/multi', { query });
  return (data?.results || [])
    .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 6)
    .map(shape);
}

export async function discoverByGenre(
  genre: string,
  { mediaType = 'movie', maxRuntime, minRating, minYear, maxYear }: {
    mediaType?: string; maxRuntime?: number; minRating?: number;
    minYear?: number; maxYear?: number;
  } = {},
) {
  const genreId = GENRE_MAP[genre];
  if (!genreId) return [];
  const params: Record<string, string> = {
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
  };
  if (minRating) params['vote_average.gte'] = String(minRating);
  // Runtime filtering is movies-only on TMDB.
  if (maxRuntime && mediaType === 'movie') params['with_runtime.lte'] = String(maxRuntime);
  if (minYear) {
    params[mediaType === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte'] = `${minYear}-01-01`;
  }
  if (maxYear) {
    params[mediaType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte'] = `${maxYear}-12-31`;
  }
  const data = await tmdb(mediaType === 'tv' ? '/discover/tv' : '/discover/movie', params);
  return (data?.results || [])
    .slice(0, 6)
    .map((r: any) => shape({ ...r, media_type: mediaType }));
}
