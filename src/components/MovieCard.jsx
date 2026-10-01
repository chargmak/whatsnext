import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { PLACEHOLDER_POSTER } from '../services/tmdb';

// A broken poster URL (TMDB pruned the file, a stale saved link) falls back to
// the local placeholder instead of the browser's broken-image glyph.
const handlePosterError = (e) => {
    if (e.currentTarget.src.endsWith(PLACEHOLDER_POSTER)) return;
    e.currentTarget.src = PLACEHOLDER_POSTER;
};

export const MovieCard = ({ movie, onClick }) => {
    const { watched } = useUser();
    // `movie.completed` flags ended series watched entirely via episode tracking,
    // which never land in the explicit watched list. Match on type as well as id:
    // movies and TV shows share the same TMDB id namespace, so a watched movie
    // would otherwise flag a same-id show (or vice versa) as seen.
    const isWatched = movie.completed || watched.some(m => m.id === movie.id && (m.type || 'movie') === (movie.type || 'movie'));

    // Get first genre for display
    const primaryGenre = movie.genres && movie.genres.length > 0 ? movie.genres[0] : null;

    const open = () => onClick(movie.id);

    return (
        <motion.div
            whileTap={{ scale: 0.95 }}
            className="card"
            role="button"
            tabIndex={0}
            aria-label={`${movie.title}${isWatched ? ' (watched)' : ''}`}
            onClick={open}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            }}
            style={{ cursor: 'pointer', minWidth: '140px', position: 'relative' }}
        >
            <div style={{ position: 'relative' }}>
                {/* Rows of posters sit mostly off-screen; lazy loading keeps the
                    first paint to the handful that are actually visible. */}
                <img
                    src={movie.poster || PLACEHOLDER_POSTER}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={500}
                    height={750}
                    onError={handlePosterError}
                />
                {isWatched && (
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(20, 20, 21, 0.8)', // Neutral glass
                        backdropFilter: 'blur(4px)',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <Check size={14} color="white" strokeWidth={3} />
                    </div>
                )}
            </div>
            <div className="card-content" style={{ paddingTop: '8px' }}>
                <h4 style={{
                    fontSize: '1rem',
                    marginBottom: '4px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.3',
                    minHeight: '2.6rem'
                }}>{movie.title}</h4>
                {primaryGenre && (
                    <div style={{ marginBottom: '4px' }}>
                        <span className="card-genre">
                            {primaryGenre}
                        </span>
                    </div>
                )}
                <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>{movie.year}</span>
                    <span style={{ color: 'var(--accent-secondary)' }}>★ {movie.rating}</span>
                </div>
            </div>
        </motion.div>
    );
};
