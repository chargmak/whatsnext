import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';
import * as userData from '../services/userData';
import { getTVWatchStatus } from '../services/tmdb';
import { resolveViewerZone } from '../services/releaseTime';

const UserContext = createContext();

const GUEST_DATA_KEYS = ['user_watchlist', 'user_watched', 'user_watched_episodes', 'user_episode_activity', 'user_reminders', 'user_data'];
const LEGACY_KEYS = ['app_users', 'current_user', 'is_authenticated', 'user_profile'];

const readLocal = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

// Add or remove episode numbers for one season, returning a new state object.
// Shared by the optimistic write and its rollback so both stay in step.
const applyEpisodes = (state, tvId, seasonNumber, episodeNumbers, watched) => {
    const tvIdStr = String(tvId);
    const seasonStr = String(seasonNumber);
    const existing = state[tvIdStr]?.[seasonStr] || [];
    const next = watched
        ? Array.from(new Set([...existing, ...episodeNumbers]))
        : existing.filter((ep) => !episodeNumbers.includes(ep));
    return { ...state, [tvIdStr]: { ...state[tvIdStr], [seasonStr]: next } };
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
        // Left unset so release times follow this device — guest data never
        // leaves it, so there's nothing that needs a zone written down.
        timezone: null,
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
    // tvId -> epoch ms of the last episode this viewer ticked for that show.
    // Drives the "most recently watched first" order in Up Next.
    const [episodeActivity, setEpisodeActivity] = useState({});
    const [reminders, setReminders] = useState([]);

    const loadedUserIdRef = useRef(null);
    const isAuthed = status === 'authed';

    const clearData = () => {
        setWatchlist([]);
        setWatched([]);
        setWatchedEpisodes({});
        setEpisodeActivity({});
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
        setEpisodeActivity(readLocal('user_episode_activity', {}));
        setReminders(readLocal('user_reminders', []));
        setStatus('guest');
    };

    const loadAuthedUser = async (authUser, { force = false } = {}) => {
        if (!force && loadedUserIdRef.current === authUser.id) return;
        loadedUserIdRef.current = authUser.id;

        const meta = authUser.user_metadata || {};
        let profile = null;
        let data = { watchlist: [], watched: [], episodes: {}, episodeActivity: {}, reminders: [] };
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
            timezone: profile?.timezone || meta.timezone || null,
            joinDate: authUser.created_at,
        });
        setWatchlist(data.watchlist);
        setWatched(data.watched);
        setWatchedEpisodes(data.episodes);
        setEpisodeActivity(data.episodeActivity || {});
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
            episodeActivity: readLocal('user_episode_activity', {}),
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

    // Episode state is written through functional updates, so the caller never
    // holds the resulting object to hand to localStorage. Mirror it here instead
    // — guests have nowhere else for their data to live.
    useEffect(() => {
        if (status === 'guest') persistLocal('user_watched_episodes', watchedEpisodes);
    }, [status, watchedEpisodes]);

    // Same story for the per-show "last watched" stamps: the server keeps its own
    // (watched_episodes.watched_at), so only guests need this mirror.
    useEffect(() => {
        if (status === 'guest') persistLocal('user_episode_activity', episodeActivity);
    }, [status, episodeActivity]);

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

    // Every episode write goes through here: it updates state optimistically and
    // syncs in the background. Both the write and its rollback are functional
    // updates against the *current* state, and the rollback only touches the
    // episodes this call actually changed — so a failed save can't wipe out ticks
    // the user made while it was in flight, and two fast taps can't clobber each
    // other by both building on the same stale snapshot.
    const writeEpisodes = (tvId, seasonNumber, episodeNumbers, watched) => {
        const nums = episodeNumbers.map(Number);
        if (!nums.length) return;

        let applied = nums;
        setWatchedEpisodes((current) => {
            const existing = current[String(tvId)]?.[String(seasonNumber)] || [];
            applied = watched
                ? nums.filter((ep) => !existing.includes(ep))
                : nums.filter((ep) => existing.includes(ep));
            return applyEpisodes(current, tvId, seasonNumber, applied, watched);
        });

        // Ticking an episode is what makes a show "recently watched"; unticking
        // is a correction, so it leaves the show's position alone.
        if (watched) setEpisodeActivity((current) => ({ ...current, [String(tvId)]: Date.now() }));

        if (!isAuthed) return; // guest data is mirrored to localStorage by effect
        userData.setSeasonEpisodesWatched(user.id, tvId, seasonNumber, nums, watched)
            .catch((error) => {
                console.error('Error saving episode state:', error);
                setWatchedEpisodes((current) =>
                    applyEpisodes(current, tvId, seasonNumber, applied, !watched));
            });
    };

    const toggleEpisodeWatched = (tvId, seasonNumber, episodeNumber) => {
        writeEpisodes(tvId, seasonNumber, [episodeNumber],
            !isEpisodeWatched(tvId, seasonNumber, episodeNumber));
    };

    const isEpisodeWatched = (tvId, seasonNumber, episodeNumber) => {
        return watchedEpisodes[String(tvId)]?.[String(seasonNumber)]?.includes(Number(episodeNumber)) || false;
    };

    // Mark (or unmark) every episode of a season in one go.
    const setSeasonWatched = (tvId, seasonNumber, episodeNumbers, watched) => {
        writeEpisodes(tvId, seasonNumber, episodeNumbers, watched);
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

        seasons.forEach(([seasonNum, count]) =>
            writeEpisodes(movie.id, seasonNum, episodeNumbersFor(count), true));
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
                timezone: merged.timezone || null,
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

    // Series the user has actually seen episodes of. Ticking episodes is the
    // usual way a show gets watched here — no explicit "mark watched" is ever
    // required — so `watched` alone misses shows someone has worked all the way
    // through. Recommendation rows use this to keep those shows out. Ids are
    // numbers, matching TMDB payloads (the episode map is keyed by string).
    const watchedTvIds = useMemo(() => {
        const ids = new Set();
        Object.entries(watchedEpisodes).forEach(([tvId, seasons]) => {
            const seen = Object.values(seasons || {}).some((eps) => eps.length > 0);
            if (seen) ids.add(Number(tvId));
        });
        return ids;
    }, [watchedEpisodes]);

    // The zone every release time in the app is rendered in: the viewer's pinned
    // setting, else this device, else the country on their profile.
    const timeZone = useMemo(
        () => resolveViewerZone({ timezone: user?.timezone, country: user?.country }),
        [user?.timezone, user?.country],
    );

    return (
        <UserContext.Provider value={{
            status,
            user,
            timeZone,
            loading: status === 'loading',
            recoveryMode,
            stats,
            watchlist,
            watched,
            watchedEpisodes,
            watchedTvIds,
            episodeActivity,
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
