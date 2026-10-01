import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { getTrendingMovies, getTrendingTV, getTopRated, getRecommendationsFromSeeds, mapMediaData, clearTmdbCache } from '../services/tmdb';
import { MovieCard } from '../components/MovieCard';
import { PosterRow, PosterRowSkeleton } from '../components/PosterRow';
import { WhatsNextSpotlight } from '../components/WhatsNextSpotlight';
import UpNext from '../components/UpNext';
import { useUser } from '../context/UserContext';

const Home = () => {
    const { user, watchlist, watched, watchedTvIds, timeZone } = useUser();
    const navigate = useNavigate();
    // Initialize from session storage if available, otherwise default to 'tv'
    // so a fresh visit lands on the first tab, TV Shows.
    const [mediaType, setMediaType] = useState(() => {
        return sessionStorage.getItem('homeMediaType') || 'tv';
    });
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    // Set when the trending request came back empty-handed, so the row can say
    // so and offer a retry instead of showing stand-in titles.
    const [trendingFailed, setTrendingFailed] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    const [topRated, setTopRated] = useState([]);
    const [topRatedLoading, setTopRatedLoading] = useState(true);
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);

    // Persist mediaType to session storage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('homeMediaType', mediaType);
    }, [mediaType]);

    // Seeds for personalized recommendations: the titles the user has saved for
    // the active tab. Titles already saved or watched are excluded from results.
    // Match media type the way the rest of the app does — legacy items saved
    // before `type` was stored default to 'movie' — so a watched movie or series
    // is reliably skipped from the recommendations instead of slipping through.
    // A series counts as watched from its episode ticks too, not just an explicit
    // "mark watched": someone who has worked through every season of a show has
    // clearly seen it, and proposing it back to them is noise.
    const recInputs = useMemo(() => {
        const seeds = watchlist.filter((item) => (item.type || 'movie') === mediaType);
        const excludeIds = new Set([
            ...seeds.map((item) => item.id),
            ...watched.filter((item) => (item.type || 'movie') === mediaType).map((item) => item.id),
            ...(mediaType === 'tv' ? watchedTvIds : []),
        ]);
        return { seeds, excludeIds };
    }, [watchlist, watched, watchedTvIds, mediaType]);

    // Shows we can compute a "next episode" for — same source the Library's
    // Up Next tab uses: the TV entries saved to the watchlist.
    const tvWatchlist = useMemo(
        () => watchlist.filter((item) => item.type === 'tv'),
        [watchlist]
    );

    useEffect(() => {
        let active = true;
        const loadRecs = async () => {
            const { seeds, excludeIds } = recInputs;
            // Drop any stale picks (possibly from the other tab) before fetching.
            setRecommendations([]);
            if (seeds.length === 0) {
                setRecsLoading(false);
                return;
            }
            setRecsLoading(true);
            const recs = await getRecommendationsFromSeeds(seeds, mediaType, excludeIds);
            if (!active) return;
            setRecommendations(recs);
            setRecsLoading(false);
        };
        loadRecs();
        return () => { active = false; };
    }, [recInputs, mediaType]);

    useEffect(() => {
        let active = true;
        const loadMedia = async () => {
            setLoading(true);
            setTrendingFailed(false);
            // Whatever happens in here, the loading flag has to come back down:
            // an error that leaves it up strands the row on a skeleton forever.
            try {
                const data = mediaType === 'tv' ? await getTrendingTV() : await getTrendingMovies();
                // A quick tab switch can land the previous tab's response after
                // this one's — never let the stale list overwrite the fresh one.
                if (!active) return;

                if (data?.results?.length) {
                    // Ensure we tag them correctly before mapping
                    const taggedResults = data.results.map(item => ({ ...item, media_type: mediaType }));
                    setMediaItems(taggedResults.map((item) => mapMediaData(item, timeZone)));
                } else {
                    setMediaItems([]);
                    setTrendingFailed(true);
                }
            } catch (error) {
                console.error('Error loading trending titles:', error);
                if (!active) return;
                setMediaItems([]);
                setTrendingFailed(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        loadMedia();
        return () => { active = false; };
    }, [mediaType, timeZone, retryKey]);

    const retryTrending = () => {
        clearTmdbCache();
        setRetryKey((k) => k + 1);
    };

    // Highest rated titles for the active tab. Kept separate from the trending
    // request so a slow or failed call only affects its own row.
    useEffect(() => {
        let active = true;
        const loadTopRated = async () => {
            // Drop the other tab's titles so they never flash under this tab.
            setTopRated([]);
            setTopRatedLoading(true);
            try {
                const data = await getTopRated(mediaType);
                if (!active) return;
                const results = data?.results || [];
                setTopRated(results.map((item) => mapMediaData({ ...item, media_type: mediaType }, timeZone)));
            } catch (error) {
                console.error('Error loading top rated titles:', error);
            } finally {
                if (active) setTopRatedLoading(false);
            }
        };
        loadTopRated();
        return () => { active = false; };
    }, [mediaType, timeZone]);

    // No full-page loading gate: the header, the tab toggle and the spotlight
    // don't depend on the trending request, so blocking the whole page behind it
    // left visitors staring at "Loading..." for the length of a network round
    // trip. Only the trending row itself waits, and it waits as a skeleton.
    const trendingPending = loading && mediaItems.length === 0;

    return (
        <div className="container" style={{ paddingBottom: '160px' }}>
            {/* New Brand Header */}
            <header className="page-header">
                <div>
                    <h1 className="brand-title">
                        What's Next?
                    </h1>
                </div>

                <div className="flex-center" style={{ gap: '12px' }}>
                    {/* Profile Icon */}
                    <motion.div
                        className="top-bar-btn"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate('/profile')}
                    >
                        <img
                            src={user?.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                            alt="Profile"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </motion.div>
                </div>
            </header>

            {/* Content Toggle - the spotlight and every section below follow it */}
            <div className="toggle-container">
                {['tv', 'movie'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setMediaType(type)}
                        className={`toggle-btn ${mediaType === type ? 'active' : ''}`}
                    >
                        {type === 'movie' ? 'Movies' : 'TV Shows'}
                        {mediaType === type && (
                            <motion.div
                                layoutId="activeTab"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'var(--brand-600)',
                                    borderRadius: '12px',
                                    zIndex: -1,
                                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                                }}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* "What's Next?" spotlight — answers the app's namesake question */}
            <WhatsNextSpotlight mediaType={mediaType} />

            {/* Up Next — the next unwatched episode of every series in the list,
                most recently watched show first. TV-only by nature, so it rides
                the TV tab, and it stays hidden until there is at least one show
                to resolve an episode for. Only the top 5 show here; "See All"
                leads to the Library's full list. */}
            {mediaType === 'tv' && tvWatchlist.length > 0 && (
                <section style={{ marginBottom: '40px' }}>
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                        <h3>Up Next</h3>
                        <button
                            onClick={() => navigate('/library')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                padding: 0
                            }}
                        >
                            See All
                        </button>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Pick up where you left off in the shows you follow
                    </p>

                    <UpNext series={tvWatchlist} limit={5} />
                </section>
            )}

            {/* Trending Section */}
            <section style={{ marginBottom: '40px' }}>
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                    <h3>Trending {mediaType === 'movie' ? 'Movies' : 'TV Shows'}</h3>
                    <button
                        onClick={() => navigate('/search')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            padding: 0
                        }}
                    >
                        See All
                    </button>
                </div>

                {trendingPending ? (
                    <PosterRowSkeleton />
                ) : trendingFailed ? (
                    <div className="glass-panel row-error">
                        <p>Couldn't load trending titles right now.</p>
                        <button type="button" className="spotlight-btn ghost" onClick={retryTrending}>
                            <RefreshCw size={16} /> Try again
                        </button>
                    </div>
                ) : (
                    <PosterRow>
                        {mediaItems.map((item) => (
                            <MovieCard
                                key={item.id}
                                movie={item}
                                onClick={(id) => navigate(`/${item.type}/${id}`)}
                            />
                        ))}
                    </PosterRow>
                )}
            </section>

            {/* Top Rated Section - all-time highest rated titles for the active tab.
                Hidden once loading finishes with nothing to show. */}
            {(topRatedLoading || topRated.length > 0) && (
                <section style={{ marginBottom: '40px' }}>
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                        <h3>Top Rated {mediaType === 'movie' ? 'Movies' : 'TV Shows'}</h3>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        The highest rated {mediaType === 'movie' ? 'movies' : 'shows'} of all time
                    </p>

                    {topRatedLoading && topRated.length === 0 ? (
                        <PosterRowSkeleton />
                    ) : (
                        <PosterRow>
                            {topRated.map((item) => (
                                <MovieCard
                                    key={item.id}
                                    movie={item}
                                    onClick={(id) => navigate(`/${item.type}/${id}`)}
                                />
                            ))}
                        </PosterRow>
                    )}
                </section>
            )}

            {/* Recommended For You - built from the user's saved list for this tab */}
            {recInputs.seeds.length > 0 && (recsLoading || recommendations.length > 0) && (
                <section style={{ marginBottom: '40px' }}>
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                        <h3>Recommended For You</h3>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Based on the {mediaType === 'movie' ? 'movies' : 'shows'} in your list
                    </p>

                    {recsLoading && recommendations.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Finding {mediaType === 'movie' ? 'movies' : 'shows'} you might like…
                        </p>
                    ) : (
                        <PosterRow>
                            {recommendations.map((item) => (
                                <MovieCard
                                    key={item.id}
                                    movie={item}
                                    onClick={(id) => navigate(`/${item.type}/${id}`)}
                                />
                            ))}
                        </PosterRow>
                    )}
                </section>
            )}

            {/* My List Section */}
            {recInputs.seeds.length > 0 && (
                <section>
                    <div className="flex-between" style={{ marginBottom: '16px' }}>
                        <h3>From Your List</h3>
                    </div>

                    <PosterRow>
                        {recInputs.seeds.map((item) => (
                                <MovieCard
                                    key={item.id}
                                    movie={item}
                                onClick={(id) => navigate(`/${item.type}/${id}`)}
                            />
                        ))}
                    </PosterRow>
                </section>
            )}
        </div>
    );
};

export default Home;
