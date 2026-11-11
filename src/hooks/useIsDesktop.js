import { useEffect, useState } from 'react';

// Keep in step with the breakpoint in src/styles/desktop.css.
export const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * True on a window wide enough for the desktop layout (sidebar, right rail).
 * Most of that layout is plain CSS; this is for the few places where desktop
 * shows different content rather than the same content arranged differently.
 */
export const useIsDesktop = () => {
    const [matches, setMatches] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);

    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY);
        const update = () => setMatches(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    return matches;
};
