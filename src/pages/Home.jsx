import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTrendingMovies, getTrendingTV, mapMediaData } from '../services/tmdb';
import { MovieCard } from '../components/MovieCard';
import { useUser } from '../context/UserContext';
import { useCineBot } from '../context/CineBotContext';
import { TRENDING_MOVIES } from '../data/mockData'; // Fallback

// One-tap starters for the "What's Next?" assistant widget.
const EXAMPLE_PROMPTS = ['What should I watch next?', 'Something funny under 90 min', 'A short thriller'];

const Home = () => {
    const { user, watchlist } = useUser();
    const { openBot } = useCineBot();
    const navigate = useNavigate();
    // Initialize from session storage if available, otherwise default to 'movie'
    const [mediaType, setMediaType] = useState(() => {
        return sessionStorage.getItem('homeMediaType') || 'movie';
    });
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Persist mediaType to session storage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('homeMediaType', mediaType);
    }, [mediaType]);

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

            {/* "What's Next?" AI assistant — answers the app's namesake question */}
            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="glass-panel"
                style={{ borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}
            >
                <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                    <Sparkles size={20} color="var(--brand-600)" />
                    <h3 style={{ margin: 0 }}>What&apos;s Next?</h3>
                </div>
                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Not sure what to watch? Ask CineBot for a pick.
                </p>

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openBot()}
                    style={{
                        width: '100%',
                        background: 'var(--accent-gradient)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                    }}
                >
                    <Sparkles size={18} /> Ask CineBot
                </motion.button>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                    {EXAMPLE_PROMPTS.map((prompt) => (
                        <motion.button
                            key={prompt}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openBot(prompt)}
                            className="meta-tag"
                            style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            {prompt}
                        </motion.button>
                    ))}
                </div>
            </motion.section>

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

                <div className="grid-layout">
                    {/* Slicing from 1 to -1 to reduce count by one as requested */}
                    {mediaItems.slice(1, -1).map((item) => (
                        <MovieCard
                            key={item.id}
                            movie={item}
                            onClick={(id) => navigate(`/${item.type}/${id}`)}
                        />
                    ))}
                </div>
            </section>

            {/* My List Section */}
            {watchlist.filter(item => item.type === mediaType).length > 0 && (
                <section>
                    <div className="flex-between" style={{ marginBottom: '16px' }}>
                        <h3>From Your List</h3>
                    </div>

                    <div className="grid-layout">
                        {watchlist
                            .filter(item => item.type === mediaType)
                            .map((item) => (
                                <MovieCard
                                    key={item.id}
                                    movie={item}
                                    onClick={(id) => navigate(`/${item.type}/${id}`)}
                                />
                            ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default Home;
