import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Swords, Rocket, Drama, Ghost, Laugh, Skull, Compass, Sparkles, Film
} from 'lucide-react';
import { discoverByGenre, mapMediaData } from '../services/tmdb';
import { MovieCard } from './MovieCard';
import { PosterRow } from './PosterRow';
import { GENRES } from '../data/genres';
import { useUser } from '../context/UserContext';

// Styles for this component live in styles/search.css (imported by the Search page).

// Genre -> icon + accent colour. Keyed by the names in GENRES (data/genres.js);
// anything unmapped falls back to Film + the brand red, so this stays robust
// if the GENRES list changes. The accent is handed to CSS as --genre-accent,
// which mixes it into the theme's own surface and text colours.
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

const FALLBACK_META = { icon: Film, accent: 'var(--brand-500)' };

// One genre tile — the whole tile is the "See all" entry point.
const GenreTile = ({ genre, onOpenGenre }) => {
    const { icon: Icon, accent } = GENRE_META[genre] || FALLBACK_META;
    return (
        <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="genre-tile"
            style={{ '--genre-accent': accent }}
            onClick={() => onOpenGenre(genre)}
        >
            <span className="genre-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={2.2} />
            </span>
            <span className="genre-text">
                <span className="genre-name truncate">{genre}</span>
                <span className="genre-sub">See all</span>
            </span>
        </motion.button>
    );
};

// A single row of mixed movie/series posters for one genre.
const GenreRow = ({ genre, onOpenGenre, onOpenItem }) => {
    const { timeZone } = useUser();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const data = await discoverByGenre(genre);
                if (!active) return;
                setItems((data?.results || [])
                    .slice(0, 12)
                    .map((item) => mapMediaData(item, timeZone)));
            } catch (error) {
                console.error(`Error loading ${genre} titles:`, error);
            } finally {
                // The row shows skeletons while this is up, so it has to clear
                // even on failure — an empty row is honest, a permanent
                // shimmer isn't.
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [genre, timeZone]);

    return (
        <section className="tile genre-row-tile">
            <div className="search-section-head">
                <h2 className="section-title truncate">Popular in {genre}</h2>
                <button
                    type="button"
                    className="link-accent"
                    aria-label={`See all ${genre}`}
                    onClick={() => onOpenGenre(genre)}
                >
                    See all
                </button>
            </div>

            {!loading && items.length === 0 ? (
                <p className="genre-row-empty">Couldn't load titles right now.</p>
            ) : (
                <PosterRow>
                    {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="poster-skeleton" aria-hidden="true" />
                        ))
                        : items.map((item) => (
                            <MovieCard
                                key={`${item.type}-${item.id}`}
                                movie={item}
                                onClick={() => onOpenItem(item)}
                            />
                        ))}
                </PosterRow>
            )}
        </section>
    );
};

export const BrowseCategories = ({ onOpenGenre, onOpenItem }) => (
    <>
        <section>
            <h2 className="section-title">Browse categories</h2>
            <div className="bento genre-grid">
                {GENRES.map((genre) => (
                    <GenreTile key={genre} genre={genre} onOpenGenre={onOpenGenre} />
                ))}
            </div>
        </section>

        {/* Only the first genre's titles are fetched up front. */}
        {GENRES.length > 0 && (
            <GenreRow
                genre={GENRES[0]}
                onOpenGenre={onOpenGenre}
                onOpenItem={onOpenItem}
            />
        )}
    </>
);
