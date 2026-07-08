import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { searchMulti, discoverByGenre } from '../services/tmdb';
import { supabase } from '../services/supabase';
import { useUser } from '../context/UserContext';
import { useCineBot } from '../context/CineBotContext';

// Real AI replies (Google Gemini, free tier) run through a Supabase Edge
// Function (see supabase/functions/cinebot). Enable by deploying it and setting
// VITE_CINEBOT_AI=true. Without it, CineBot still works using the
// intent-aware local recommender below.
const AI_ENABLED = import.meta.env.VITE_CINEBOT_AI === 'true';

// Natural-language mood/genre → TMDB genre (matches GENRE_MAP in tmdb.js).
const MOOD_MAP = [
    [/(funny|comedy|laugh|hilarious|humou?r|light[- ]?hearted)/, 'Comedy'],
    [/(scary|horror|creepy|frightening|terrifying)/, 'Horror'],
    [/(action|explosion|adrenaline|fight)/, 'Action'],
    [/(romantic|romance|love story|date night)/, 'Romance'],
    [/(thriller|suspense|tense|edge of my seat)/, 'Thriller'],
    [/(sad|emotional|cry|tear[- ]?jerker|moving|drama)/, 'Drama'],
    [/(sci[- ]?fi|science fiction|space|futuristic|dystop)/, 'Sci-Fi'],
    [/(fantasy|magic|magical|mythical)/, 'Fantasy'],
    [/(animated|animation|cartoon|anime)/, 'Animation'],
    [/(documentary|docu|true story|real life)/, 'Documentary'],
    [/(mystery|detective|whodunit|investigat)/, 'Mystery'],
    [/(family|kids|children|wholesome)/, 'Family'],
    [/(crime|heist|gangster|mafia)/, 'Crime'],
    [/(western|cowboy)/, 'Western'],
    [/(war|military|battle)/, 'War'],
    [/(adventure|epic|quest)/, 'Adventure'],
];

const LIBRARY_INTENT = /(watch ?list|my list|from my list|what should i watch|what to watch|recommend|suggest|pick something|choose|surprise me|watch next|next up)/;

const detectGenre = (text) => {
    for (const [re, genre] of MOOD_MAP) if (re.test(text)) return genre;
    return null;
};

// "under 90 min", "less than 2 hours", "short" → minutes cap (used for messaging).
const detectRuntimeCap = (text) => {
    const mins = text.match(/(\d{2,3})\s*(?:min|minutes|mins)/);
    if (mins) return Number(mins[1]);
    const hours = text.match(/(\d)\s*(?:h|hour|hours)/);
    if (hours) return Number(hours[1]) * 60;
    if (/\b(short|quick|brief)\b/.test(text)) return 100;
    return null;
};

// Opening line, shared by the greeting effect and the auto-send effect so they
// never drift apart. Kept at module scope so it isn't a render-changing dep.
const buildGreeting = (displayName) => ({
    id: 1,
    isBot: true,
    text: `Hi ${displayName}! I'm CineBot. Tell me a mood ("something funny under 90 min"), a title, or ask "what should I watch next?"`,
});

const CineBot = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, watchlist, watched } = useUser();
    const { isOpen, openBot, closeBot, pendingPrompt, consumePrompt } = useCineBot();
    const displayName = user?.name || 'there';

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const greetedRef = useRef(false);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(scrollToBottom, [messages, isTyping]);

    // Greet with the real profile name the first time the panel opens.
    useEffect(() => {
        if (isOpen && !greetedRef.current) {
            greetedRef.current = true;
            setMessages([buildGreeting(displayName)]);
        }
    }, [isOpen, displayName]);

    const pushBot = (text, link = null) =>
        setMessages((prev) => [...prev, { id: Date.now() + Math.random(), isBot: true, text, link }]);

    // Try the Gemini-powered Edge Function; return null to fall back locally.
    const tryAI = async (userText) => {
        if (!AI_ENABLED || !supabase) return null;
        try {
            const history = messages
                .filter((m) => m.text)
                .slice(-8)
                .map((m) => ({ role: m.isBot ? 'assistant' : 'user', content: m.text }));
            const { data, error } = await supabase.functions.invoke('cinebot', {
                body: { message: userText, history },
            });
            if (error || !data?.reply) return null;
            const first = Array.isArray(data.items) ? data.items[0] : null;
            return { text: data.reply, link: first ? `/${first.type}/${first.id}` : null };
        } catch {
            return null;
        }
    };

    // Intent-aware local recommender (works with no backend).
    const localReply = async (userText) => {
        const lower = userText.toLowerCase();

        if (/^\s*(hi|hey|hello|yo|sup)\b/.test(lower)) {
            return { text: `Hey ${displayName}! What are you in the mood for — a genre, a vibe, or a specific title?` };
        }

        // "What should I watch?" → pull from the user's own watchlist.
        if (LIBRARY_INTENT.test(lower) && watchlist.length > 0) {
            const pick = watchlist[Math.floor((Date.now() / 1000) % watchlist.length)];
            return {
                text: `From your watchlist, how about **${pick.title}**${pick.year ? ` (${pick.year})` : ''}? It's been waiting for you.`,
                link: `/${pick.type || 'movie'}/${pick.id}`,
            };
        }

        // Mood/genre → discover a well-rated title you haven't seen.
        const genre = detectGenre(lower);
        if (genre) {
            const cap = detectRuntimeCap(lower);
            const data = await discoverByGenre(genre);
            const seen = new Set(watched.map((m) => m.id));
            const candidates = (data?.results || []).filter((r) => !seen.has(r.id));
            const best = candidates[0];
            if (best) {
                const title = best.title || best.name;
                const type = best.media_type || (best.first_air_date ? 'tv' : 'movie');
                const year = (best.release_date || best.first_air_date)?.split('-')[0] || '';
                const capNote = cap ? ` You mentioned around ${cap} min — double-check the runtime on its page.` : '';
                return {
                    text: `For a **${genre.toLowerCase()}** pick: **${title}**${year ? ` (${year})` : ''}.\n\n${(best.overview || '').slice(0, 120)}…${capNote}`,
                    link: `/${type}/${best.id}`,
                };
            }
        }

        // Fallback: treat the input as a title search.
        const data = await searchMulti(userText);
        const match = data?.results?.find((r) => r.media_type === 'movie' || r.media_type === 'tv');
        if (match) {
            const title = match.title || match.name;
            const year = (match.release_date || match.first_air_date)?.split('-')[0] || '';
            return {
                text: `I found **${title}**${year ? ` (${year})` : ''}.\n\n${(match.overview || '').slice(0, 120)}…`,
                link: `/${match.media_type}/${match.id}`,
            };
        }
        return { text: "I couldn't find a good match for that. Try a genre, a mood, or a specific title." };
    };

    // overrideText lets the Home widget send a canned prompt through the same
    // pipeline; when omitted we use whatever is typed in the input box.
    const handleSend = async (overrideText) => {
        const userText = (typeof overrideText === 'string' ? overrideText : input).trim();
        if (!userText) return;
        setMessages((prev) => [...prev, { id: Date.now(), text: userText, isBot: false }]);
        setInput('');
        setIsTyping(true);

        try {
            const reply = (await tryAI(userText)) || (await localReply(userText));
            pushBot(reply.text, reply.link);
        } catch (error) {
            console.error('CineBot error', error);
            pushBot('Something went wrong on my end. Mind trying again?');
        } finally {
            setIsTyping(false);
        }
    };

    // When opened with a prompt (e.g. a Home "What's Next?" chip), auto-send it
    // once. consumePrompt() clears it so this fires exactly once per request.
    useEffect(() => {
        if (!isOpen || !pendingPrompt) return;
        if (!greetedRef.current) {
            greetedRef.current = true;
            setMessages([buildGreeting(displayName)]);
        }
        const prompt = pendingPrompt;
        consumePrompt();
        handleSend(prompt);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, pendingPrompt]);

    // Hide on auth screens where a floating chat would overlap the forms.
    const AUTH_ROUTES = ['/login', '/register', '/reset-password'];
    if (AUTH_ROUTES.includes(location.pathname)) return null;

    return (
        <>
            <motion.button
                className="flex-center"
                onClick={() => openBot()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    position: 'fixed',
                    bottom: '160px',
                    right: '20px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '28px',
                    background: 'var(--accent-gradient)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.5)',
                    zIndex: 900,
                    cursor: 'pointer',
                    color: 'white'
                }}
            >
                <Bot size={28} />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="glass-panel"
                        style={{
                            position: 'fixed',
                            bottom: '90px',
                            right: '20px',
                            left: '20px',
                            top: '100px',
                            maxWidth: '400px',
                            marginLeft: 'auto',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                            zIndex: 950,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div className="flex-between" style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex-center" style={{ gap: '10px' }}>
                                <Bot size={20} color="var(--brand-600)" />
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>CineBot</h3>
                            </div>
                            <button
                                onClick={() => closeBot()}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Chat Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    style={{
                                        alignSelf: msg.isBot ? 'flex-start' : 'flex-end',
                                        background: msg.isBot ? 'var(--bg-tertiary)' : 'var(--brand-600)',
                                        color: msg.isBot ? 'var(--text-primary)' : 'white',
                                        padding: '10px 14px',
                                        borderRadius: '16px',
                                        borderBottomLeftRadius: msg.isBot ? '4px' : '16px',
                                        borderBottomRightRadius: msg.isBot ? '16px' : '4px',
                                        maxWidth: '80%',
                                        fontSize: '0.9rem',
                                        lineHeight: '1.4'
                                    }}
                                >
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                    {msg.link && (
                                        <button
                                            onClick={() => { navigate(msg.link); closeBot(); }}
                                            style={{
                                                marginTop: '8px',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--brand-600)',
                                                color: 'var(--brand-600)',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                width: '100%'
                                            }}
                                        >
                                            View Details
                                        </button>
                                    )}
                                </div>
                            ))}
                            {isTyping && (
                                <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '10px' }}>
                                    CineBot is thinking...
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Mood, title, or 'what's next?'"
                                className="input-field"
                                style={{ borderRadius: '24px', padding: '10px 16px' }}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={() => handleSend()}
                                className="flex-center"
                                style={{
                                    width: '42px', height: '42px', borderRadius: '50%',
                                    background: 'var(--brand-600)', border: 'none', color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default CineBot;
