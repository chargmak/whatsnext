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
        // FORCE DEMO USER FOR PORTFOLIO
        const initDemoSession = () => {
            // Check if we have saved data, otherwise use default mock
            const savedUser = localStorage.getItem('user_data');

            if (savedUser) {
                setUser(JSON.parse(savedUser));
            } else {
                // Initialize with mock data
                const demoUser = {
                    ...CURRENT_USER,
                    id: 'demo-user-123',
                    email: 'demo@example.com'
                };
                setUser(demoUser);
                localStorage.setItem('user_data', JSON.stringify(demoUser));
            }

            // Load other local data
            loadFromLocalStorage();
            setLoading(false);
        };

        initDemoSession();
    }, []);

    // --- Helpers ---

    const loadFromLocalStorage = () => {
        // const savedUser = localStorage.getItem('user_data'); // Handled in init
        const savedWatchlist = localStorage.getItem('user_watchlist');
        const savedWatched = localStorage.getItem('user_watched');
        const savedEpisodes = localStorage.getItem('user_watched_episodes');
        // const isAuthenticated = localStorage.getItem('is_authenticated') === 'true'; // Ignored for demo

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

    // --- Actions ---

    const login = async (email, password) => {
        // DEMO MODE: Simulate login or do nothing since we are always logged in
        console.log("Demo Mode: Login simulated for", email);
        alert("Demo Mode: You are already logged in as the demo user.");
    };

    const signup = async (email, password, metadata) => {
        // DEMO MODE: Simulate signup
        console.log("Demo Mode: Signup simulated for", email);
        alert("Demo Mode: Registration disabled. You are using the demo account.");
    };

    const logout = async () => {
        // DEMO MODE: Reset to default demo state instead of logging out
        if (confirm("Demo Mode: This will reset your demo data. Continue?")) {
            localStorage.removeItem('user_watchlist');
            localStorage.removeItem('user_watched');
            localStorage.removeItem('user_watched_episodes');
            setWatchlist([]);
            setWatched([]);
            setWatchedEpisodes({});
            alert("Demo data reset!");
            window.location.reload();
        }
    };

    // --- Data Management ---

    const addToWatchlist = async (movie) => {
        // Optimistic Update
        if (!watchlist.find(m => m.id === movie.id)) {
            const newList = [...watchlist, movie];
            setWatchlist(newList);
            localStorage.setItem('user_watchlist', JSON.stringify(newList));
        }
    };

    const removeFromWatchlist = async (movieId) => {
        const newList = watchlist.filter(m => m.id !== movieId);
        setWatchlist(newList);
        localStorage.setItem('user_watchlist', JSON.stringify(newList));
    };

    const markAsWatched = async (movie) => {
        if (!watched.find(m => m.id === movie.id)) {
            const newWatched = [...watched, movie];
            setWatched(newWatched);
            localStorage.setItem('user_watched', JSON.stringify(newWatched));

            const newWl = watchlist.filter(m => m.id !== movie.id);
            setWatchlist(newWl);
            localStorage.setItem('user_watchlist', JSON.stringify(newWl));
        }
    };

    const removeFromWatched = async (movie) => {
        const newWatched = watched.filter(m => m.id !== movie.id);
        setWatched(newWatched);
        localStorage.setItem('user_watched', JSON.stringify(newWatched));
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
