import React, { useState, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { MovieCard } from '../components/MovieCard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

const Library = () => {
    const [activeTab, setActiveTab] = useState('watchlist');
    const [sortBy, setSortBy] = useState('dateAdded'); // dateAdded, title, rating
    const [filterType, setFilterType] = useState('all'); // all, movie, tv
    const { watchlist, watched } = useUser();
    const navigate = useNavigate();

    // Get items based on active tab
    const rawItems = activeTab === 'watchlist' ? watchlist : watched;

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
            <div className="toggle-container" style={{ marginBottom: '24px' }}>
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
