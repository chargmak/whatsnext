import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';
import * as userData from '../services/userData';
import { getTVWatchStatus } from '../services/tmdb';

const UserContext = createContext();

const GUEST_DATA_KEYS = ['user_watchlist', 'user_watched', 'user_watched_episodes', 'user_reminders', 'user_data'];
const LEGACY_KEYS = ['app_users', 'current_user', 'is_authenticated', 'user_profile'];

const readLocal = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const createGuestUser = () => {
    const guestNames = [
        "Alex", "Jordan", "Taylor", "Casey", "Riley", "Sam", "Jamie",
        "Neo", "Trinity", "Morpheus", "Skywalker", "Ripley", "Marty", "Doc",
        "Maverick", "Goose", "Rocky", "Apollo", "Indiana", "Han", "Leia"
    ];
    const name = guestNames[Math.floor(Math.random() * guestNames.length)];
    return {
        id: `guest-${Math.floor(Math.random() * 100000)}`,
        email: null,
        name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        country: '',
        bio: '',
        joinDate: new Date().toISOString(),
    };
};

export const UserProvider = ({ children }) => {
    // status: 'loading' | 'authed' | 'guest' | 'signedOut'
    const [status, setStatus] = useState('loading');
    const [user, setUser] = useState(null);
    const [recoveryMode, setRecoveryMode] = useState(false);

    const [watchlist, setWatchlist] = useState([]);
    const [watched, setWatched] = useState([]);
    const [watchedEpisodes, setWatchedEpisodes] = useState({});
    const [reminders, setReminders] = useState([]);

    const loadedUserIdRef = useRef(null);
    const isAuthed = status === 'authed';

    const clearData = () => {
        setWatchlist([]);
        setWatched([]);
        setWatchedEpisodes({});
        setReminders([]);
    };

    const enterGuestMode = () => {
        localStorage.setItem('guest_mode', 'true');
        let guestUser = readLocal('user_data', null);
        if (!guestUser) {
            guestUser = createGuestUser();
            localStorage.setItem('user_data', JSON.stringify(guestUser));
        }
        setUser(guestUser);
        setWatchlist(readLocal('user_watchlist', []));
        setWatched(readLocal('user_watched', []));
        setWatchedEpisodes(readLocal('user_watched_episodes', {}));
        setReminders(readLocal('user_reminders', []));
        setStatus('guest');
    };

    const loadAuthedUser = async (authUser, { force = false } = {}) => {
        if (!force && loadedUserIdRef.current === authUser.id) return;
        loadedUserIdRef.current = authUser.id;

        const meta = authUser.user_metadata || {};
        let profile = null;
        let data = { watchlist: [], watched: [], episodes: {}, reminders: [] };
        try {
            [profile, data] = await Promise.all([
                userData.fetchProfile(authUser.id),
                userData.fetchAllUserData(authUser.id),
            ]);
        } catch (error) {
            console.error('Error loading account data:', error);
        }

        setUser({
            id: authUser.id,
            email: authUser.email,
            name: profile?.full_name || meta.full_name || authUser.email?.split('@')[0] || 'User',
            avatar: profile?.avatar_url || meta.avatar_url
                || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.id}`,
            country: profile?.country || meta.country || '',
            bio: profile?.bio || meta.bio || '',
            joinDate: authUser.created_at,
        });
        setWatchlist(data.watchlist);
        setWatched(data.watched);
        setWatchedEpisodes(data.episodes);
        setReminders(data.reminders);
        setStatus('authed');
        localStorage.removeItem('guest_mode');
    };

    useEffect(() => {
        LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));

        if (!supabase) {
            // Bootstrap from localStorage — one-time init, not a cascading render
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (localStorage.getItem('guest_mode') === 'true') enterGuestMode();
            else setStatus('signedOut');
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                loadAuthedUser(session.user);
            } else if (localStorage.getItem('guest_mode') === 'true') {
                enterGuestMode();
            } else {
                setStatus('signedOut');
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // Never await inside the callback (supabase-js deadlocks); defer instead.
            setTimeout(() => {
                if (event === 'SIGNED_IN' && session?.user) {
                    loadAuthedUser(session.user);
                } else if (event === 'SIGNED_OUT') {
                    loadedUserIdRef.current = null;
                    setUser(null);
                    clearData();
                    setStatus('signedOut');
                } else if (event === 'PASSWORD_RECOVERY') {
                    setRecoveryMode(true);
                } else if (event === 'USER_UPDATED' && session?.user) {
                    setUser((prev) => (prev ? { ...prev, email: session.user.email } : prev));
                }
            }, 0);
        });

        return () => subscription.unsubscribe();
    }, []);

    // --- Local data migration (guest → account) ---

    const maybeMigrateLocalData = async (userId) => {
        const local = {
            watchlist: readLocal('user_watchlist', []),
            watched: readLocal('user_watched', []),
            episodes: readLocal('user_watched_episodes', {}),
            reminders: readLocal('user_reminders', []),
        };
        const hasData = local.watchlist.length || local.watched.length
            || Object.keys(local.episodes).length || local.reminders.length;
        if (!hasData || localStorage.getItem('migration_declined') === 'true') return;

        const ok = window.confirm('Import the watchlist and watched history saved on this device into your account?');
        if (!ok) {
            localStorage.setItem('migration_declined', 'true');
            return;
        }
        try {
            await userData.migrateLocalData(userId, local);
            GUEST_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
        } catch (error) {
            console.error('Error importing local data:', error);
        }
    };

    // --- Auth actions ---

    const login = async (email, password) => {
        if (!supabase) throw new Error('Accounts are unavailable in this deployment. Use "Continue as guest" instead.');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        await maybeMigrateLocalData(data.user.id);
        await loadAuthedUser(data.user, { force: true });
        return {};
    };

    const signup = async (email, password, metadata) => {
        if (!supabase) throw new Error('Accounts are unavailable in this deployment. Use "Continue as guest" instead.');
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: metadata },
        });
        if (error) throw new Error(error.message);
        // With confirmations enabled, Supabase returns a user with no identities
        // for an already-registered email instead of an error.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            throw new Error('This email is already registered. Try logging in instead.');
        }
        if (data.user && !data.session) return { needsConfirmation: true };
        await maybeMigrateLocalData(data.user.id);
        await loadAuthedUser(data.user, { force: true });
        return {};
    };

    const logout = async () => {
        if (isAuthed && supabase) {
            await supabase.auth.signOut();
            loadedUserIdRef.current = null;
            setUser(null);
            clearData();
            setStatus('signedOut');
        } else {
            localStorage.removeItem('guest_mode');
            if (window.confirm('Also delete the guest data stored on this device?')) {
                GUEST_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
            }
            setUser(null);
            clearData();
            setStatus('signedOut');
        }
    };

    const resetPassword = async (email) => {
        if (!supabase) throw new Error('Accounts are unavailable in this deployment.');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw new Error(error.message);
    };

    const changePassword = async (newPassword) => {
        if (!supabase) throw new Error('Accounts are unavailable in this deployment.');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
        setRecoveryMode(false);
    };

    const deleteAccount = async () => {
        if (!supabase) throw new Error('Accounts are unavailable in this deployment.');
        const { error } = await supabase.rpc('delete_user');
        if (error) throw new Error(error.message);
        await supabase.auth.signOut();
        loadedUserIdRef.current = null;
        setUser(null);
        clearData();
        setStatus('signedOut');
    };

    // --- Watchlist / history ---

    const persistLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value));

    // Movies and TV shows live in separate TMDB id namespaces, so a movie and a
    // show can share the same numeric id. Every match must compare type too, or
    // one masks the other (e.g. a watched movie makes a same-id show look seen).
    const sameMedia = (a, b) => a.id === b.id && (a.type || 'movie') === (b.type || 'movie');

    const addToWatchlist = async (movie) => {
        if (watchlist.find((m) => sameMedia(m, movie))) return;
        const prev = watchlist;
        const newList = [...watchlist, movie];
        setWatchlist(newList);
        if (isAuthed) {
            try {
                await userData.upsertWatchlistItem(user.id, movie);
            } catch (error) {
                console.error('Error adding to watchlist:', error);
                setWatchlist(prev);
            }
        } else {
            persistLocal('user_watchlist', newList);
        }
    };

    const removeFromWatchlist = async (movieId, mediaType = 'movie') => {
        const item = watchlist.find((m) => m.id === movieId && (m.type || 'movie') === mediaType);
        const prev = watchlist;
        const newList = watchlist.filter((m) => !(m.id === movieId && (m.type || 'movie') === mediaType));
        setWatchlist(newList);
        if (isAuthed && item) {
            try {
                await userData.deleteWatchlistItem(user.id, item.id, item.type || 'movie');
            } catch (error) {
                console.error('Error removing from watchlist:', error);
                setWatchlist(prev);
            }
        } else {
            persistLocal('user_watchlist', newList);
        }
    };

    const markAsWatched = async (movie) => {
        if (watched.find((m) => sameMedia(m, movie))) return;
        const prevWatched = watched;
        const prevWatchlist = watchlist;
        const newWatched = [...watched, movie];
        const newWatchlist = watchlist.filter((m) => !sameMedia(m, movie));
        setWatched(newWatched);
        setWatchlist(newWatchlist);
        if (isAuthed) {
            try {
                await userData.upsertHistoryItem(user.id, movie);
                await userData.deleteWatchlistItem(user.id, movie.id, movie.type || 'movie');
            } catch (error) {
                console.error('Error marking as watched:', error);
                setWatched(prevWatched);
                setWatchlist(prevWatchlist);
            }
        } else {
            persistLocal('user_watched', newWatched);
            persistLocal('user_watchlist', newWatchlist);
        }
    };

    const removeFromWatched = async (movie) => {
        const prev = watched;
        const newWatched = watched.filter((m) => !sameMedia(m, movie));
        setWatched(newWatched);
        if (isAuthed) {
            try {
                await userData.deleteHistoryItem(user.id, movie.id, movie.type || 'movie');
            } catch (error) {
                console.error('Error removing from watched:', error);
                setWatched(prev);
            }
        } else {
            persistLocal('user_watched', newWatched);
        }
    };

    // --- TV episodes ---

    const toggleEpisodeWatched = (tvId, seasonNumber, episodeNumber) => {
        const tvIdStr = String(tvId);
        const seasonStr = String(seasonNumber);
        const episodeNum = Number(episodeNumber);

        const prev = watchedEpisodes;
        const newState = JSON.parse(JSON.stringify(watchedEpisodes));
        if (!newState[tvIdStr]) newState[tvIdStr] = {};
        if (!newState[tvIdStr][seasonStr]) newState[tvIdStr][seasonStr] = [];

        const episodes = newState[tvIdStr][seasonStr];
        const index = episodes.indexOf(episodeNum);
        const nowWatched = index === -1;
        if (nowWatched) episodes.push(episodeNum);
        else episodes.splice(index, 1);

        setWatchedEpisodes(newState);
        if (isAuthed) {
            userData.setEpisodeWatched(user.id, tvId, seasonNumber, episodeNum, nowWatched)
                .catch((error) => {
                    console.error('Error saving episode state:', error);
                    setWatchedEpisodes(prev);
                });
        } else {
            persistLocal('user_watched_episodes', newState);
        }
    };

    const isEpisodeWatched = (tvId, seasonNumber, episodeNumber) => {
        return watchedEpisodes[String(tvId)]?.[String(seasonNumber)]?.includes(Number(episodeNumber)) || false;
    };

    // Mark (or unmark) every episode of a season in one go.
    const setSeasonWatched = (tvId, seasonNumber, episodeNumbers, watched) => {
        const tvIdStr = String(tvId);
        const seasonStr = String(seasonNumber);
        const nums = episodeNumbers.map(Number);
        if (!nums.length) return;

        const prev = watchedEpisodes;
        const newState = JSON.parse(JSON.stringify(watchedEpisodes));
        if (!newState[tvIdStr]) newState[tvIdStr] = {};
        const existing = newState[tvIdStr][seasonStr] || [];

        if (watched) {
            newState[tvIdStr][seasonStr] = Array.from(new Set([...existing, ...nums]));
        } else {
            newState[tvIdStr][seasonStr] = existing.filter((ep) => !nums.includes(ep));
        }

        setWatchedEpisodes(newState);
        if (isAuthed) {
            userData.setSeasonEpisodesWatched(user.id, tvId, seasonNumber, nums, watched)
                .catch((error) => {
                    console.error('Error saving season state:', error);
                    setWatchedEpisodes(prev);
                });
        } else {
            persistLocal('user_watched_episodes', newState);
        }
    };

    const isSeasonWatched = (tvId, seasonNumber, episodeNumbers) => {
        if (!episodeNumbers.length) return false;
        const watchedSet = watchedEpisodes[String(tvId)]?.[String(seasonNumber)] || [];
        return episodeNumbers.every((ep) => watchedSet.includes(Number(ep)));
    };

    const getWatchedEpisodeCount = (tvId) => {
        const seasons = watchedEpisodes[String(tvId)];
        if (!seasons) return 0;
        return Object.values(seasons).reduce((total, episodes) => total + episodes.length, 0);
    };

    // "Seen it" on a whole title: file it in history and — for a series — tick
    // off every episode of every season in one pass, so the show reads as fully
    // watched everywhere (per-episode checkmarks, stats, the Library's
    // completed-series detection). Season 0 (specials) is excluded, matching the
    // rest of the app's "main run" bookkeeping. Episode marking runs after the
    // history write and never blocks it: if the series lookup fails, the title
    // is still recorded as watched.
    const markTitleWatched = async (movie) => {
        await markAsWatched(movie);
        if ((movie.type || 'movie') !== 'tv') return;

        let info;
        try {
            info = await getTVWatchStatus(movie.id);
        } catch (error) {
            console.error('Error loading series episodes:', error);
            return;
        }

        const seasons = Object.entries(info?.seasonEpisodeCounts || {});
        if (!seasons.length) return;
        // TMDB numbers episodes 1..count within a season; this is the same
        // representation the app's completion checks already assume.
        const episodeNumbersFor = (count) => Array.from({ length: count }, (_, i) => i + 1);

        const tvIdStr = String(movie.id);
        const prev = watchedEpisodes;
        const newState = JSON.parse(JSON.stringify(watchedEpisodes));
        if (!newState[tvIdStr]) newState[tvIdStr] = {};
        seasons.forEach(([seasonNum, count]) => {
            const existing = newState[tvIdStr][seasonNum] || [];
            newState[tvIdStr][seasonNum] = Array.from(new Set([...existing, ...episodeNumbersFor(count)]));
        });
        setWatchedEpisodes(newState);

        if (isAuthed) {
            try {
                await Promise.all(seasons.map(([seasonNum, count]) =>
                    userData.setSeasonEpisodesWatched(user.id, movie.id, seasonNum, episodeNumbersFor(count), true)
                ));
            } catch (error) {
                console.error('Error saving series episodes:', error);
                setWatchedEpisodes(prev);
            }
        } else {
            persistLocal('user_watched_episodes', newState);
        }
    };

    // --- Reminders ("Notify Me") ---

    // Movies and TV shows share the TMDB id namespace, so — like watchlist and
    // watched — reminders must be matched on type too, or a same-id movie/show
    // masks or removes the other's reminder.
    const isReminderSet = (movieId, mediaType = 'movie') =>
        reminders.some((r) => r.id === movieId && (r.type || 'movie') === mediaType);

    const toggleReminder = async (movie) => {
        const prev = reminders;
        const type = movie.type || 'movie';
        if (isReminderSet(movie.id, type)) {
            const newList = reminders.filter((r) => !(r.id === movie.id && (r.type || 'movie') === type));
            setReminders(newList);
            if (isAuthed) {
                try {
                    await userData.removeReminder(user.id, movie.id, movie.type || 'movie');
                } catch (error) {
                    console.error('Error removing reminder:', error);
                    setReminders(prev);
                }
            } else {
                persistLocal('user_reminders', newList);
            }
        } else {
            const entry = {
                id: movie.id,
                type: movie.type || 'movie',
                title: movie.title,
                poster: movie.poster,
                releaseDate: movie.releaseDate || null,
            };
            const newList = [...reminders, entry];
            setReminders(newList);
            if (isAuthed) {
                try {
                    await userData.addReminder(user.id, entry);
                } catch (error) {
                    console.error('Error adding reminder:', error);
                    setReminders(prev);
                }
            } else {
                persistLocal('user_reminders', newList);
            }
        }
    };

    // --- Profile ---

    const updateUser = (updates) => {
        const merged = { ...user, ...updates };
        setUser(merged);
        if (isAuthed) {
            userData.updateProfile(user.id, {
                full_name: merged.name,
                avatar_url: merged.avatar,
                country: merged.country || null,
                bio: merged.bio || null,
            }).catch((error) => console.error('Error saving profile:', error));
        } else {
            localStorage.setItem('user_data', JSON.stringify(merged));
        }
    };

    // --- Stats (computed from real data) ---

    const stats = useMemo(() => {
        const moviesWatched = watched.filter((m) => m.type === 'movie').length;
        const showsWatched = watched.filter((m) => m.type === 'tv').length;
        const episodesWatched = Object.values(watchedEpisodes).reduce(
            (total, seasons) => total + Object.values(seasons).reduce((s, eps) => s + eps.length, 0),
            0
        );

        let minutes = episodesWatched * 40;
        watched.forEach((m) => {
            if (m.type !== 'movie') return;
            const match = /(?:(\d+)h)?\s*(?:(\d+)m)?/.exec(m.runtime || '');
            const parsed = match ? (parseInt(match[1] || 0, 10) * 60 + parseInt(match[2] || 0, 10)) : 0;
            minutes += parsed || 120;
        });
        const hoursWatched = Math.round(minutes / 60);

        const genreCounts = {};
        watched.forEach((m) => (m.genres || []).forEach((g) => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        }));
        const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        const activity = watched.length + episodesWatched;
        const rank = activity >= 50 ? 'Cinephile' : activity >= 10 ? 'Enthusiast' : 'Beginner';

        return { moviesWatched, showsWatched, episodesWatched, hoursWatched, favoriteGenre, rank };
    }, [watched, watchedEpisodes]);

    return (
        <UserContext.Provider value={{
            status,
            user,
            loading: status === 'loading',
            recoveryMode,
            stats,
            watchlist,
            watched,
            watchedEpisodes,
            reminders,
            addToWatchlist,
            removeFromWatchlist,
            markAsWatched,
            markTitleWatched,
            removeFromWatched,
            toggleEpisodeWatched,
            isEpisodeWatched,
            setSeasonWatched,
            isSeasonWatched,
            getWatchedEpisodeCount,
            isReminderSet,
            toggleReminder,
            updateUser,
            login,
            signup,
            logout,
            resetPassword,
            changePassword,
            deleteAccount,
            enterGuestMode,
        }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);
