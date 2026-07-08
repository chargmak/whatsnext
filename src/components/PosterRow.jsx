import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A single horizontal row of posters that slides left and right.
 *
 * On touch devices this is a native swipe; on devices with a pointer we also
 * render arrow buttons that page through the row. Designed to wrap any set of
 * cards (MovieCard, etc.) so future homepage sections get the same behaviour
 * for free — just drop the cards inside a <PosterRow>.
 */
export const PosterRow = ({ children }) => {
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Re-evaluate which arrows should be shown based on the current scroll
    // position (with a 1px tolerance to avoid sub-pixel flicker at the edges).
    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 1);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollState();
        el.addEventListener('scroll', updateScrollState, { passive: true });
        // Recompute when the row resizes or its contents change.
        const observer = new ResizeObserver(updateScrollState);
        observer.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollState);
            observer.disconnect();
        };
    }, [updateScrollState, children]);

    const slide = (direction) => {
        const el = scrollRef.current;
        if (!el) return;
        // Page by ~80% of the visible width so a card stays on screen as an anchor.
        el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
    };

    return (
        <div className="poster-row-wrapper">
            <button
                type="button"
                className={`poster-row-arrow left ${canScrollLeft ? 'visible' : ''}`}
                onClick={() => slide(-1)}
                aria-label="Scroll left"
                tabIndex={canScrollLeft ? 0 : -1}
            >
                <ChevronLeft size={22} />
            </button>

            <div className="poster-row" ref={scrollRef}>
                {children}
            </div>

            <button
                type="button"
                className={`poster-row-arrow right ${canScrollRight ? 'visible' : ''}`}
                onClick={() => slide(1)}
                aria-label="Scroll right"
                tabIndex={canScrollRight ? 0 : -1}
            >
                <ChevronRight size={22} />
            </button>
        </div>
    );
};
