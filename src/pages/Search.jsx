import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, History, X, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchMulti, mapMediaData, discoverByGenre } from '../services/tmdb';
import { MovieCard } from '../components/MovieCard';
import { GENRES } from '../data/mockData';

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
        if (debouncedQuery) {
            const fetchResults = async () => {
                const data = await searchMulti(debouncedQuery);
                if (data && data.results) {
                    // Filter for only movies and tv (skip people)
                    const filtered = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
                    setResults(filtered.map(mapMediaData));
                }
            };
            fetchResults();
            setSelectedGenre(null); // Clear genre when searching
        } else {
            setResults([]);
        }
    }, [debouncedQuery]);

    const handleGenreClick = async (genre) => {
        setSelectedGenre(genre);
        setQuery(''); // Clear search query

        // Fetch movies/TV shows by genre
        const data = await discoverByGenre(genre);
        if (data && data.results) {
            setResults(data.results.map(mapMediaData));
        }
    };

    const handleResultClick = (id, type, title) => {
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

    return (
        <div className="container" style={{ paddingTop: '20px', paddingBottom: '90px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <SearchIcon
                    style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }}
                    size={20}
                />
                <input
                    type="text"
                    placeholder="Search movies & TV shows..."
                    className="input-field"
                    style={{ paddingLeft: '40px' }}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                    <button
                        onClick={() => setQuery('')}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '12px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Filters (Only show when searching or filtering) */}
            {(query || selectedGenre) && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{
                                appearance: 'none',
                                padding: '8px 32px 8px 12px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            <option value="all">All Types</option>
                            <option value="movie">Movies</option>
                            <option value="tv">TV Shows</option>
                        </select>
                        <SlidersHorizontal
                            size={14}
                            style={{ position: 'absolute', right: '10px', top: '10px', pointerEvents: 'none', color: 'var(--text-secondary)' }}
                        />
                    </div>

                    {selectedGenre && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'var(--brand-600)',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            fontSize: '0.9rem'
                        }}>
                            <span>{selectedGenre}</span>
                            <X
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    setSelectedGenre(null);
                                    setResults([]);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Recent Searches */}
            {!query && !selectedGenre && searchHistory.length > 0 && (
                <section style={{ marginBottom: '32px' }}>
                    <div className="flex-between" style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>Recent Searches</h3>
                        <button
                            onClick={clearHistory}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <Trash2 size={14} /> Clear
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {searchHistory.map((term, index) => (
                            <div
                                key={index}
                                onClick={() => handleHistoryClick(term)}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            >
                                <History size={14} />
                                {term}
                                <button
                                    onClick={(e) => removeHistoryItem(e, term)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        marginLeft: '4px'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Browse Categories */}
            {!query && !selectedGenre && (
                <section>
                    <h3 style={{ marginBottom: '16px' }}>Browse Categories</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {GENRES.map(genre => (
                            <span
                                key={genre}
                                onClick={() => handleGenreClick(genre)}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: '1px solid transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--brand-600)';
                                    e.currentTarget.style.color = 'white';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {genre}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* No Results */}
            {displayedResults.length === 0 && (query || selectedGenre) && (
                <div className="flex-center" style={{ marginTop: '40px', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                    <SearchIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p>No results found for "{query || selectedGenre}"</p>
                    {filterType !== 'all' && <p style={{ fontSize: '0.85rem' }}>Try changing the filter type.</p>}
                </div>
            )}

            {/* Results Grid */}
            {displayedResults.length > 0 && (
                <div className="grid-layout">
                    {displayedResults.map(item => (
                        <MovieCard
                            key={item.id}
                            movie={item}
                            onClick={(id) => handleResultClick(id, item.type, item.title)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Search;
