import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTrendingMovies, getTrendingTV, getRecommendationsFromSeeds, mapMediaData } from '../services/tmdb';
import { MovieCard } from '../components/MovieCard';
import { PosterRow } from '../components/PosterRow';
import { useUser } from '../context/UserContext';
import { TRENDING_MOVIES } from '../data/mockData'; // Fallback

const Home = () => {
    const { user, watchlist, watched } = useUser();
    const navigate = useNavigate();
    // Initialize from session storage if available, otherwise default to 'movie'
    const [mediaType, setMediaType] = useState(() => {
        return sessionStorage.getItem('homeMediaType') || 'movie';
    });
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);

    // Persist mediaType to session storage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('homeMediaType', mediaType);
    }, [mediaType]);

    // Seeds for personalized recommendations: the titles the user has saved for
    // the active tab. Titles already saved or watched are excluded from results.
    const recInputs = useMemo(() => {
        const seeds = watchlist.filter((item) => item.type === mediaType);
        const excludeIds = new Set([
            ...seeds.map((item) => item.id),
            ...watched.filter((item) => item.type === mediaType).map((item) => item.id),
        ]);
        return { seeds, excludeIds };
    }, [watchlist, watched, mediaType]);

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
        const loadMedia = async () => {
            setLoading(true);
            let data;
            if (mediaType === 'tv') {
                data = await getTrendingTV();
            } else {
                data = await getTrendingMovies();
            }

            if (data && data.results) {
                // Ensure we tag them correctly before mapping
                const taggedResults = data.results.map(item => ({ ...item, media_type: mediaType }));
                setMediaItems(taggedResults.map(mapMediaData));
            } else {
                setMediaItems(TRENDING_MOVIES);
            }
            setLoading(false);
        };
        loadMedia();
    }, [mediaType]);

    if (loading && mediaItems.length === 0) return <div className="container flex-center" style={{ height: '100vh' }}>Loading...</div>;

    return (
        <div className="container" style={{ paddingBottom: '160px' }}>
            {/* New Brand Header */}
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

            {/* Content Toggle - Below Header */}
            {/* Content Toggle - Below Header */}
            <div className="toggle-container">
                {['movie', 'tv'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setMediaType(type)}
                        className={`toggle-btn ${mediaType === type ? 'active' : ''}`}
                    >
                        {type === 'movie' ? 'Movies' : 'TV Series'}
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

            {/* Trending Section */}
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

                <PosterRow>
                    {/* Slicing from 1 to -1 to reduce count by one as requested */}
                    {mediaItems.slice(1, -1).map((item) => (
                        <MovieCard
                            key={item.id}
                            movie={item}
                            onClick={(id) => navigate(`/${item.type}/${id}`)}
                        />
                    ))}
                </PosterRow>
            </section>

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
            {watchlist.filter(item => item.type === mediaType).length > 0 && (
                <section>
                    <div className="flex-between" style={{ marginBottom: '16px' }}>
                        <h3>From Your List</h3>
                    </div>

                    <PosterRow>
                        {watchlist
                            .filter(item => item.type === mediaType)
                            .map((item) => (
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
