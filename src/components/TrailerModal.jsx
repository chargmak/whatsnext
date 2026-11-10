import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import '../styles/trailer.css';

/**
 * Full-screen YouTube trailer overlay, shared by the detail page and the
 * "What's Next?" spotlight. Render it inside an <AnimatePresence> and only
 * when a trailer should be showing — the component itself is always "open".
 */
export const TrailerModal = ({ trailerKey, title, onClose }) => {
    // Escape closes it, as a dialog should.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <motion.div
            className="trailer-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`${title} — Trailer`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <div className="trailer-bar">
                <h2 className="trailer-title">{title} · Trailer</h2>
                <button
                    type="button"
                    className="trailer-close"
                    onClick={onClose}
                    aria-label="Close trailer"
                    autoFocus
                >
                    <X size={18} strokeWidth={2.5} aria-hidden="true" />
                </button>
            </div>

            <div className="trailer-stage">
                <div className="trailer-player" onClick={(e) => e.stopPropagation()}>
                    {/* Sits behind the player, so a blocked/slow embed shows a hint instead of a black void. */}
                    <div className="trailer-hint">Loading trailer…</div>
                    {/* Muted + playsinline so autoplay is allowed on mobile (esp. iOS) instead of
                        stalling on a black frame; rel=0 keeps unrelated videos out of the end card. */}
                    <iframe
                        src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&playsinline=1&rel=0`}
                        title={`${title} — Trailer`}
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    ></iframe>
                </div>

                {/* Escape hatch when the embed can't play (region locks, disabled embedding, no network). */}
                <a
                    className="trailer-link"
                    href={`https://www.youtube.com/watch?v=${trailerKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                >
                    Trailer not playing?
                    <strong>Watch on YouTube <ExternalLink size={14} aria-hidden="true" /></strong>
                </a>
            </div>
        </motion.div>
    );
};
