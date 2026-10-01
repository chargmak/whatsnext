import { useState, useEffect } from 'react';

// useState backed by localStorage. Key should already include any per-user
// prefix the caller wants (e.g. `prefs:${userId}:notifications`).
const usePersistentState = (key, defaultValue) => {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Storage can be full or disabled (private mode); the in-memory
            // value still works for this session.
        }
    }, [key, value]);

    return [value, setValue];
};

export default usePersistentState;
