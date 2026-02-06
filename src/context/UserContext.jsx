import React, { createContext, useContext, useState, useEffect } from 'react';
import { CURRENT_USER } from '../data/mockData';
import { supabase } from '../services/supabase';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    // User State
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Data State
    const [watchlist, setWatchlist] = useState([]);
    const [watched, setWatched] = useState([]);
    const [watchedEpisodes, setWatchedEpisodes] = useState({});

    // Initialize User & Session
    useEffect(() => {
        const initSession = async () => {
            if (supabase) {
                // Check active session
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    await fetchUserProfile(session.user.id);
                    await fetchUserData(session.user.id);
                } else {
                    // Fallback to local storage if no Supabase session (or for guest/demo)
                    loadFromLocalStorage();
                }

                // Listen for changes
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                    if (session) {
                        await fetchUserProfile(session.user.id);
                        await fetchUserData(session.user.id);
                    } else {
                        setUser(null);
                        loadFromLocalStorage();
                    }
                });

                setLoading(false);
                return () => subscription.unsubscribe();
            } else {
                // If Supabase is not configured, just use local storage
                loadFromLocalStorage();
                setLoading(false);
            }
        };

        initSession();
    }, []);

    // --- Helpers ---

    const loadFromLocalStorage = () => {
        const savedUser = localStorage.getItem('user_data');
        const savedWatchlist = localStorage.getItem('user_watchlist');
        const savedWatched = localStorage.getItem('user_watched');
        const savedEpisodes = localStorage.getItem('user_watched_episodes');
        const isAuthenticated = localStorage.getItem('is_authenticated') === 'true';

        // Only set user if explicitly authenticated locally (e.g. demo)
        if (isAuthenticated && savedUser) {
            setUser(JSON.parse(savedUser));
        }

        if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
        if (savedWatched) setWatched(JSON.parse(savedWatched));
        if (savedEpisodes) setWatchedEpisodes(JSON.parse(savedEpisodes));
    };

    const fetchUserProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data) {
                // Merge with default properties for app compatibility
                setUser({
                    ...data,
                    name: data.full_name || data.username,
                    avatar: data.avatar_url,
                    stats: createDefaultStats() // We'll calculate stats from DB later
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const fetchUserData = async (userId) => {
        try {
            // Fetch Watchlist
            const { data: wlData } = await supabase.from('watchlists').select('*');
            if (wlData) {
                setWatchlist(wlData.map(mapDbToMovie));
            }

            // Fetch History
            const { data: hData } = await supabase.from('history').select('*');
            if (hData) {
                setWatched(hData.map(mapDbToMovie));
                // Recalc stats
                // ... logic to recalc stats from history
            }

        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    const mapDbToMovie = (dbItem) => ({
        id: dbItem.movie_id,
        title: dbItem.title,
        posterValues: dbItem.poster_path, // Assuming adapter needed
        type: dbItem.media_type,
        poster_path: dbItem.poster_path,
        vote_average: dbItem.vote_average
    });

    const createDefaultStats = () => ({
        moviesWatched: 0,
        hoursWatched: 0,
        favoriteGenre: 'None'
    });

    // --- Actions ---

    const login = async (email, password) => {
        if (!supabase) {
            // Local fallback logic (handled in component currently, but could move here)
            throw new Error('Supabase not configured');
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem('is_authenticated', 'true');
    };

    const signup = async (email, password, metadata) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: metadata }
        });
        if (error) throw error;
        localStorage.setItem('is_authenticated', 'true');
    };

    const logout = async () => {
        if (supabase) await supabase.auth.signOut();
        localStorage.removeItem('is_authenticated');
        localStorage.removeItem('user_data');
        localStorage.removeItem('current_user'); // Clean legacy
        setUser(null);
        setWatchlist([]);
        setWatched([]);
        setWatchedEpisodes({});
    };

    // --- Data Management ---

    const addToWatchlist = async (movie) => {
        // Optimistic Update
        if (!watchlist.find(m => m.id === movie.id)) {
            setWatchlist(prev => [...prev, movie]);

            // Sync to DB
            if (supabase && user) {
                await supabase.from('watchlists').insert({
                    user_id: user.id || user.uuid, // Handle auth user vs local
                    movie_id: movie.id,
                    media_type: movie.type || 'movie',
                    title: movie.title,
                    poster_path: movie.poster_path,
                    vote_average: movie.vote_average
                });
            } else {
                localStorage.setItem('user_watchlist', JSON.stringify([...watchlist, movie]));
            }
        }
    };

    const removeFromWatchlist = async (movieId) => {
        setWatchlist(prev => prev.filter(m => m.id !== movieId));

        if (supabase && user) {
            await supabase.from('watchlists').delete().match({ movie_id: movieId, user_id: user.id });
        } else {
            const newList = watchlist.filter(m => m.id !== movieId);
            localStorage.setItem('user_watchlist', JSON.stringify(newList));
        }
    };

    const markAsWatched = async (movie) => {
        if (!watched.find(m => m.id === movie.id)) {
            const newWatched = [...watched, movie];
            setWatched(newWatched);
            removeFromWatchlist(movie.id);

            if (supabase && user) {
                await supabase.from('history').insert({
                    user_id: user.id,
                    movie_id: movie.id,
                    media_type: movie.type || 'movie',
                    title: movie.title,
                    poster_path: movie.poster_path,
                    vote_average: movie.vote_average
                });
                // Also remove from watchlist DB
                await supabase.from('watchlists').delete().match({ movie_id: movie.id, user_id: user.id });
            } else {
                localStorage.setItem('user_watched', JSON.stringify(newWatched));
                const newWl = watchlist.filter(m => m.id !== movie.id);
                localStorage.setItem('user_watchlist', JSON.stringify(newWl));
            }
        }
    };

    const removeFromWatched = async (movie) => {
        const newWatched = watched.filter(m => m.id !== movie.id);
        setWatched(newWatched);

        if (supabase && user) {
            await supabase.from('history').delete().match({ movie_id: movie.id, user_id: user.id });
        } else {
            localStorage.setItem('user_watched', JSON.stringify(newWatched));
        }
    };

    // --- TV Episodes (Keep Local for now as schema is complex) ---
    const toggleEpisodeWatched = (tvId, seasonNumber, episodeNumber) => {
        setWatchedEpisodes(prev => {
            // ... (keep existing complex logic)
            const tvIdStr = String(tvId);
            const seasonStr = String(seasonNumber);
            const episodeNum = Number(episodeNumber);
            const newState = JSON.parse(JSON.stringify(prev));
            if (!newState[tvIdStr]) newState[tvIdStr] = {};
            if (!newState[tvIdStr][seasonStr]) newState[tvIdStr][seasonStr] = [];

            const episodes = newState[tvIdStr][seasonStr];
            const index = episodes.indexOf(episodeNum);
            if (index > -1) episodes.splice(index, 1);
            else episodes.push(episodeNum);

            localStorage.setItem('user_watched_episodes', JSON.stringify(newState));
            return newState;
        });
    };

    const isEpisodeWatched = (tvId, seasonNumber, episodeNumber) => {
        const tvIdStr = String(tvId);
        const seasonStr = String(seasonNumber);
        const episodeNum = Number(episodeNumber);
        return watchedEpisodes[tvIdStr]?.[seasonStr]?.includes(episodeNum) || false;
    };

    const getWatchedEpisodeCount = (tvId) => {
        const tvIdStr = String(tvId);
        if (!watchedEpisodes[tvIdStr]) return 0;
        return Object.values(watchedEpisodes[tvIdStr]).reduce((total, episodes) => total + episodes.length, 0);
    };

    const updateUser = (updates) => {
        setUser(prev => ({ ...prev, ...updates }));
        // In local mode, save to LS
        if (!supabase || !user?.id) {
            localStorage.setItem('user_data', JSON.stringify({ ...user, ...updates }));
        }
    };

    return (
        <UserContext.Provider value={{
            user,
            loading,
            watchlist,
            watched,
            watchedEpisodes,
            addToWatchlist,
            removeFromWatchlist,
            markAsWatched,
            removeFromWatched,
            toggleEpisodeWatched,
            isEpisodeWatched,
            getWatchedEpisodeCount,
            updateUser,
            login,
            signup,
            logout
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
