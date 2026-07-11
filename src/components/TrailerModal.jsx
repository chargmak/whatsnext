import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Full-screen YouTube trailer overlay, shared by the detail page and the
 * "What's Next?" spotlight. Render it inside an <AnimatePresence> and only
 * when a trailer should be showing — the component itself is always "open".
 */
export const TrailerModal = ({ trailerKey, title, onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.95)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', gap: '14px'
        }}
    >
        <button
            onClick={onClose}
            style={{
                position: 'absolute', top: '20px', right: '20px',
                background: 'white', border: 'none', borderRadius: '50%',
                width: '40px', height: '40px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            <X size={24} color="black" />
        </button>

        <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: '900px', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 0 30px rgba(255,255,255,0.1)', background: '#000' }}
        >
            {/* Sits behind the player, so a blocked/slow embed shows a hint instead of a black void. */}
            <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '16px'
            }}>
                Loading trailer…
            </div>
            {/* Muted + playsinline so autoplay is allowed on mobile (esp. iOS) instead of
                stalling on a black frame; rel=0 keeps unrelated videos out of the end card. */}
            <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&playsinline=1&rel=0`}
                title={`${title} — Trailer`}
                frameBorder="0"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'relative', zIndex: 1, display: 'block' }}
            ></iframe>
        </div>

        {/* Escape hatch when the embed can't play (region locks, disabled embedding, no network). */}
        <a
            href={`https://www.youtube.com/watch?v=${trailerKey}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textDecoration: 'underline' }}
        >
            Trailer not playing? Watch on YouTube ↗
        </a>
    </motion.div>
);
