import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useUser } from '../context/UserContext';

export const MovieCard = ({ movie, onClick }) => {
    const { watched } = useUser();
    // Ensure accurate type comparison, though IDs are usually numbers
    const isWatched = watched.some(m => m.id === movie.id);

    // Get first genre for display
    const primaryGenre = movie.genres && movie.genres.length > 0 ? movie.genres[0] : null;

    return (
        <motion.div
            whileTap={{ scale: 0.95 }}
            className="card"
            onClick={() => onClick(movie.id)}
            style={{ cursor: 'pointer', minWidth: '140px', position: 'relative' }}
        >
            <div style={{ position: 'relative' }}>
                <img src={movie.poster} alt={movie.title} />
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
                        <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            fontWeight: '500'
                        }}>
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
