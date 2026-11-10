import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { MovieCard } from '../components/MovieCard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { getTVWatchStatus } from '../services/tmdb';
import UpNext from '../components/UpNext';
import '../styles/library.css';

// Toggle order + display labels; internal ids stay space-free.
const TABS = [
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'upnext', label: 'Up Next' },
    { id: 'watched', label: 'Watched' },
];

const Library = () => {
    const [activeTab, setActiveTab] = useState('upnext');
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

    // Shows we can compute a "next episode" for: the TV entries in the watchlist.
    const tvWatchlist = useMemo(
        () => watchlist.filter((item) => item.type === 'tv'),
        [watchlist]
    );

    // Apply filtering and sorting
    const items = useMemo(() => {
        // Items are appended as they're added, so position doubles as "when".
        // Remember it before filtering rather than calling indexOf inside the
        // comparator, which made the default sort quadratic.
        const indexed = rawItems.map((item, index) => ({ item, index }));
        const filtered = filterType === 'all'
            ? indexed
            : indexed.filter(({ item }) => item.type === filterType);

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return (a.item.title || '').localeCompare(b.item.title || '');
                case 'rating':
                    return (Number(b.item.rating) || 0) - (Number(a.item.rating) || 0);
                case 'dateAdded':
                default:
                    return b.index - a.index; // most recent first
            }
        });

        return filtered.map(({ item }) => item);
    }, [rawItems, sortBy, filterType]);

    return (
        <div className="container page">
            <h1 className="page-title">Library</h1>

            <div className="seg" role="group" aria-label="Library section">
                {TABS.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        className={`seg-btn ${activeTab === id ? 'active' : ''}`}
                        aria-pressed={activeTab === id}
                    >
                        {label}
                        {activeTab === id && (
                            <motion.span
                                layoutId="libraryActiveTab"
                                className="seg-thumb"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {activeTab === 'upnext' ? (
                <UpNext series={tvWatchlist} />
            ) : (
                <>
                    {/* Sort and Filter Controls */}
                    <div className="library-controls">
                        <span className="select-pill">
                            <select
                                className="pill-btn on-page"
                                aria-label="Sort by"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="dateAdded">Recently Added</option>
                                <option value="title">Title (A-Z)</option>
                                <option value="rating">Rating (High-Low)</option>
                            </select>
                            <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
                        </span>

                        <span className="select-pill">
                            <select
                                className="pill-btn on-page"
                                aria-label="Filter by type"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="all">All Types</option>
                                <option value="movie">Movies Only</option>
                                <option value="tv">TV Shows Only</option>
                            </select>
                            <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
                        </span>

                        <span className="mono-label library-count" aria-live="polite">
                            {items.length} {items.length === 1 ? 'title' : 'titles'}
                        </span>
                    </div>

                    {items.length > 0 ? (
                        <div className="grid-layout">
                            {items.map(item => (
                                <MovieCard
                                    key={`${item.type || 'movie'}-${item.id}`}
                                    movie={item}
                                    onClick={(id) => navigate(`/${item.type || 'movie'}/${id}`)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state library-empty">
                            <p>
                                {filterType !== 'all'
                                    ? `No ${filterType === 'movie' ? 'movies' : 'TV shows'} in your ${activeTab}.`
                                    : `Your ${activeTab} is empty.`
                                }
                            </p>
                            <button type="button" className="pill-btn primary" onClick={() => navigate('/search')}>
                                Explore {activeTab === 'watchlist' ? 'Content' : 'History'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Library;
