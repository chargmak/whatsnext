import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Swords, Rocket, Drama, Ghost, Laugh, Skull, Compass, Sparkles, Film, ChevronRight
} from 'lucide-react';
import { discoverByGenre, mapMediaData } from '../services/tmdb';
import { MovieCard } from './MovieCard';
import { GENRES } from '../data/mockData';

// Genre -> icon + accent colour. Keyed by the names in GENRES (mockData.js);
// anything unmapped falls back to Film + the brand red, so this stays robust
// if the GENRES list changes.
const GENRE_META = {
    'Action': { icon: Swords, accent: '#F97316' },
    'Sci-Fi': { icon: Rocket, accent: '#6366F1' },
    'Drama': { icon: Drama, accent: '#F59E0B' },
    'Horror': { icon: Ghost, accent: '#8B5CF6' },
    'Comedy': { icon: Laugh, accent: '#EAB308' },
    'Thriller': { icon: Skull, accent: '#64748B' },
    'Adventure': { icon: Compass, accent: '#14B8A6' },
    'Fantasy': { icon: Sparkles, accent: '#EC4899' },
};

const FALLBACK_META = { icon: Film, accent: '#EF4444' }; // brand red

// Tint a #RRGGBB accent to an rgba() string (matches the rgba tinting used
// elsewhere in the app; avoids color-mix() for older mobile browsers).
const tint = (hex, alpha) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const PosterSkeleton = () => (
    <div
        style={{
            minWidth: '140px',
            width: '140px',
            aspectRatio: '2 / 3',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.05)',
            animation: 'pulse-fade 1.4s ease-in-out infinite',
        }}
    />
);

const CategoryRow = ({ genre, onOpenGenre, onOpenItem }) => {
    const { icon: Icon, accent } = GENRE_META[genre] || FALLBACK_META;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            const data = await discoverByGenre(genre);
            if (!active) return;
            const mapped = (data?.results || []).map(mapMediaData).slice(0, 12);
            setItems(mapped);
            setLoading(false);
        };
        load();
        return () => { active = false; };
    }, [genre]);

    return (
        <section style={{ marginBottom: '28px' }}>
            {/* Header — the whole row is the "See all" entry point */}
            <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpenGenre(genre)}
                className="flex-between"
                style={{ marginBottom: '12px', cursor: 'pointer' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        className="flex-center"
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: 'var(--radius-md)',
                            background: tint(accent, 0.16),
                            border: `1px solid ${tint(accent, 0.35)}`,
                            flexShrink: 0,
                        }}
                    >
                        <Icon size={20} color={accent} strokeWidth={2.2} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{genre}</h4>
                </div>
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                    }}
                >
                    See all <ChevronRight size={16} />
                </span>
            </motion.div>

            {/* Horizontal strip of mixed movie/series posters */}
            <div
                className="hide-scrollbar"
                style={{
                    display: 'flex',
                    gap: '14px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {loading &&
                    Array.from({ length: 5 }).map((_, i) => <PosterSkeleton key={i} />)}

                {!loading && items.length === 0 && (
                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                        Couldn't load titles right now.
                    </p>
                )}

                {!loading &&
                    items.map((item, index) => (
                        <div
                            key={`${item.type}-${item.id}`}
                            style={{
                                minWidth: '140px',
                                width: '140px',
                                // End-align the last poster so `mandatory` has a
                                // valid snap stop where it reveals in full (a
                                // start-aligned last item would sit past max
                                // scroll and stay clipped).
                                scrollSnapAlign: index === items.length - 1 ? 'end' : 'start',
                            }}
                        >
                            <MovieCard movie={item} onClick={() => onOpenItem(item)} />
                        </div>
                    ))}
            </div>
        </section>
    );
};

export const BrowseCategories = ({ onOpenGenre, onOpenItem }) => (
    <section>
        <h3 style={{ marginBottom: '20px' }}>Browse Categories</h3>
        {GENRES.map((genre) => (
            <CategoryRow
                key={genre}
                genre={genre}
                onOpenGenre={onOpenGenre}
                onOpenItem={onOpenItem}
            />
        ))}
    </section>
);
