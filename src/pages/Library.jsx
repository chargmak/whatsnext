import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { MovieCard } from '../components/MovieCard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import { getTVWatchStatus } from '../services/tmdb';

const Library = () => {
    const [activeTab, setActiveTab] = useState('watchlist');
    const [sortBy, setSortBy] = useState('dateAdded'); // dateAdded, title, rating
    const [filterType, setFilterType] = useState('all'); // all, movie, tv
    const { watchlist, watched, watchedEpisodes } = useUser();
    const navigate = useNavigate();

    // Ended series where every available episode has been ticked off never got
    // an explicit "mark watched", so surface them in the Watched tab too.
    const [completedSeries, setCompletedSeries] = useState([]);
    // Cache TMDB series details across tab switches (status rarely changes);
    // the completion decision itself is recomputed from live watched episodes.
    const seriesDetailsCache = useRef({});

    useEffect(() => {
        if (activeTab !== 'watched') return;
        let active = true;

        const load = async () => {
            const tvIds = Object.keys(watchedEpisodes).filter((tvId) =>
                Object.values(watchedEpisodes[tvId] || {}).some((eps) => eps.length > 0)
            );

            await Promise.all(tvIds.map(async (tvId) => {
                if (seriesDetailsCache.current[tvId] === undefined) {
                    seriesDetailsCache.current[tvId] = await getTVWatchStatus(tvId);
                }
            }));
            if (!active) return;

            const completed = tvIds
                .map((tvId) => {
                    const info = seriesDetailsCache.current[tvId];
                    if (!info || !info.ended) return null;

                    const seasons = Object.entries(info.seasonEpisodeCounts);
                    if (seasons.length === 0) return null;

                    const allWatched = seasons.every(([seasonNum, count]) =>
                        (watchedEpisodes[tvId]?.[seasonNum]?.length || 0) >= count
                    );
                    return allWatched ? { ...info, completed: true } : null;
                })
                .filter(Boolean);

            setCompletedSeries(completed);
        };

        load();
        return () => { active = false; };
    }, [activeTab, watchedEpisodes]);

    // Merge explicit watched history with auto-detected completed series,
    // de-duping by media type + id so an already-marked show isn't listed twice.
    const watchedItems = useMemo(() => {
        const byKey = new Map();
        watched.forEach((item) => byKey.set(`${item.type}-${item.id}`, item));
        completedSeries.forEach((series) => {
            const key = `${series.type}-${series.id}`;
            if (!byKey.has(key)) byKey.set(key, series);
        });
        return Array.from(byKey.values());
    }, [watched, completedSeries]);

    // Get items based on active tab
    const rawItems = activeTab === 'watchlist' ? watchlist : watchedItems;

    // Apply filtering and sorting
    const items = useMemo(() => {
        let filtered = [...rawItems];

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(item => item.type === filterType);
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'dateAdded':
                default:
                    // Most recent first (assuming items are added to end of array)
                    return rawItems.indexOf(b) - rawItems.indexOf(a);
            }
        });

        return filtered;
    }, [rawItems, sortBy, filterType]);

    return (
        <div className="container" style={{ paddingTop: '20px', paddingBottom: '90px' }}>
            <h1>My Library</h1>

            {/* Toggle Container - Matching Home Page Style */}
            <div className="toggle-container" style={{ margin: '30px 0' }}>
                {['watchlist', 'watched'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`toggle-btn ${activeTab === tab ? 'active' : ''}`}
                        style={{ textTransform: 'capitalize' }}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="libraryActiveTab"
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

            {/* Sort and Filter Controls */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SlidersHorizontal size={18} color="var(--text-secondary)" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        <option value="dateAdded">Recently Added</option>
                        <option value="title">Title (A-Z)</option>
                        <option value="rating">Rating (High-Low)</option>
                    </select>
                </div>

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        outline: 'none'
                    }}
                >
                    <option value="all">All Types</option>
                    <option value="movie">Movies Only</option>
                    <option value="tv">TV Shows Only</option>
                </select>
            </div>

            {items.length > 0 ? (
                <div className="grid-layout">
                    {items.map(item => (
                        <MovieCard
                            key={item.id}
                            movie={item}
                            onClick={(id) => navigate(`/${item.type || 'movie'}/${id}`)}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <p>
                        {filterType !== 'all'
                            ? `No ${filterType === 'movie' ? 'movies' : 'TV shows'} in your ${activeTab}.`
                            : `Your ${activeTab} is empty.`
                        }
                    </p>
                    <button className="btn" style={{ marginTop: '10px' }} onClick={() => navigate('/search')}>
                        Explore {activeTab === 'watchlist' ? 'Content' : 'History'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Library;
