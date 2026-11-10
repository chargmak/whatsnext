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

    const open = () => onClick(movie.id);

    // One line under the poster: type and year, or whatever the caller wants
    // to flag there instead (e.g. a countdown) via `movie.meta`.
    const meta = movie.meta
        || [movie.type === 'tv' ? 'TV' : 'Movie', movie.year && movie.year !== 'N/A' ? movie.year : null]
            .filter(Boolean)
            .join(' · ');

    return (
        <motion.div
            whileTap={{ scale: 0.96 }}
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
        >
            {/* Rows of posters sit mostly off-screen; lazy loading keeps the
                first paint to the handful that are actually visible. The 2:3
                box comes from `.card img { aspect-ratio }` in CSS — no
                width/height attributes here, since a height attribute would
                win over that rule and render the poster 750px tall. */}
            <img
                src={movie.poster || PLACEHOLDER_POSTER}
                alt=""
                loading="lazy"
                decoding="async"
                onError={handlePosterError}
            />
            {isWatched && (
                <span className="card-check" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                </span>
            )}
            <div className="card-content">
                <div className="card-title">{movie.title}</div>
                <div className="card-meta">{meta}</div>
            </div>
        </motion.div>
    );
};
