import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchMulti, mapMediaData, discoverByGenre } from '../services/tmdb';
import { MovieCard } from '../components/MovieCard';
import { BrowseCategories } from '../components/BrowseCategories';
import { useUser } from '../context/UserContext';
import '../styles/search.css';

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const Search = () => {
    const navigate = useNavigate();
    const { timeZone } = useUser();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [searchHistory, setSearchHistory] = useState(() => {
        return JSON.parse(localStorage.getItem('search_history') || '[]');
    });
    const [filterType, setFilterType] = useState('all'); // 'all', 'movie', 'tv'

    const debouncedQuery = useDebounce(query, 500);

    // Save history when it changes
    useEffect(() => {
        localStorage.setItem('search_history', JSON.stringify(searchHistory));
    }, [searchHistory]);

    useEffect(() => {
        if (!debouncedQuery) {
            // Clearing results when the query empties — not a cascading render
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setResults((prev) => (prev.length ? [] : prev));
            return;
        }
        let active = true;
        const fetchResults = async () => {
            const data = await searchMulti(debouncedQuery);
            // Keystrokes outpace the network: a response for an earlier query
            // must not replace the results of the one typed after it.
            if (!active) return;
            // Filter for only movies and tv (skip people)
            const filtered = (data?.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
            setResults(filtered.map((item) => mapMediaData(item, timeZone)));
            setSelectedGenre(null); // Clear genre when searching
        };
        fetchResults();
        return () => { active = false; };
    }, [debouncedQuery, timeZone]);

    const handleGenreClick = async (genre) => {
        setSelectedGenre(genre);
        setQuery(''); // Clear search query

        // Fetch movies/TV shows by genre
        const data = await discoverByGenre(genre);
        setResults((data?.results || []).map((item) => mapMediaData(item, timeZone)));
    };

    const handleResultClick = (id, type) => {
        // Add to search history if searching
        if (query) {
            const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
            setSearchHistory(newHistory);
        }
        navigate(`/${type}/${id}`);
    };

    const handleHistoryClick = (historyItem) => {
        setQuery(historyItem);
    };

    const clearHistory = () => {
        if (window.confirm('Clear search history?')) {
            setSearchHistory([]);
        }
    };

    const removeHistoryItem = (e, item) => {
        e.stopPropagation();
        setSearchHistory(prev => prev.filter(i => i !== item));
    };

    // Filter results based on type
    const displayedResults = results.filter(item => {
        if (filterType === 'all') return true;
        return item.type === filterType;
    });

    const browsing = !query && !selectedGenre;
    const TYPE_FILTERS = [
        { id: 'all', label: 'All types' },
        { id: 'movie', label: 'Movies' },
        { id: 'tv', label: 'TV shows' },
    ];

    return (
        <div className="container page">
            <h1 className="page-title">Search</h1>

            {/* Search Input */}
            <div className="search-bar">
                <label className={`search-field ${query ? 'has-value' : ''}`}>
                    <SearchIcon size={20} aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search movies & TV shows..."
                        aria-label="Search movies and TV shows"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </label>
                {query && (
                    <button
                        type="button"
                        className="icon-btn on-page search-clear"
                        aria-label="Clear search"
                        onClick={() => setQuery('')}
                    >
                        <X size={18} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Filters (Only show when searching or filtering) */}
            {!browsing && (
                <div className="search-filters hide-scrollbar" role="group" aria-label="Filter results">
                    {TYPE_FILTERS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            className={`chip ${filterType === id ? 'active' : ''}`}
                            aria-pressed={filterType === id}
                            onClick={() => setFilterType(id)}
                        >
                            {label}
                        </button>
                    ))}

                    {selectedGenre && (
                        <button
                            type="button"
                            className="chip tint"
                            aria-label={`Clear ${selectedGenre} filter`}
                            onClick={() => {
                                setSelectedGenre(null);
                                setResults([]);
                            }}
                        >
                            {selectedGenre}
                            <X size={12} strokeWidth={3} aria-hidden="true" />
                        </button>
                    )}
                </div>
            )}

            {/* Recent Searches */}
            {browsing && searchHistory.length > 0 && (
                <section>
                    <div className="search-section-head">
                        <h2 className="section-title">Recent searches</h2>
                        <button type="button" className="link-accent" onClick={clearHistory}>
                            Clear
                        </button>
                    </div>
                    <div className="recent-list">
                        {searchHistory.map((term, index) => (
                            <div key={index} className="recent-pill">
                                <button
                                    type="button"
                                    className="recent-term truncate"
                                    onClick={() => handleHistoryClick(term)}
                                >
                                    {term}
                                </button>
                                <button
                                    type="button"
                                    className="recent-remove"
                                    aria-label={`Remove ${term} from recent searches`}
                                    onClick={(e) => removeHistoryItem(e, term)}
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Browse Categories */}
            {browsing && (
                <BrowseCategories
                    onOpenGenre={handleGenreClick}
                    onOpenItem={(item) => navigate(`/${item.type}/${item.id}`)}
                />
            )}

            {/* No Results */}
            {displayedResults.length === 0 && !browsing && (
                <div className="empty-state search-empty">
                    <SearchIcon size={40} className="search-empty-icon" aria-hidden="true" />
                    <p>No results found for "{query || selectedGenre}"</p>
                    {filterType !== 'all' && <p className="search-empty-hint">Try changing the filter type.</p>}
                </div>
            )}

            {/* Results Grid */}
            {displayedResults.length > 0 && (
                <>
                    <div className="mono-label" aria-live="polite">
                        {displayedResults.length} {displayedResults.length === 1 ? 'result' : 'results'}
                    </div>
                    <div className="grid-layout">
                        {displayedResults.map(item => (
                            <MovieCard
                                key={`${item.type}-${item.id}`}
                                movie={item}
                                onClick={(id) => handleResultClick(id, item.type)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Search;
