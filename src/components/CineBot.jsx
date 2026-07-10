import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles, ArrowUpRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { searchMulti, discoverByGenre } from '../services/tmdb';
import { supabase } from '../services/supabase';
import { useUser } from '../context/UserContext';
import { useCineBot } from '../context/CineBotContext';

// Real AI replies (Google Gemini, free tier) run through a Supabase Edge
// Function (see supabase/functions/cinebot). This is ON by default whenever
// Supabase is configured: if the function isn't deployed or errors, tryAI()
// gracefully falls back to the intent-aware local recommender below, so the
// app always works. Opt out with VITE_CINEBOT_AI=false to force the local
// recommender. (Previously this was opt-IN via VITE_CINEBOT_AI=true, so a
// forgotten Vercel build flag silently downgraded CineBot to the dumb path
// even when the Gemini backend was deployed and working.)
const AI_ENABLED = import.meta.env.VITE_CINEBOT_AI !== 'false';

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

// One-tap conversation starters shown under the greeting.
const SUGGESTIONS = [
    { emoji: '🍿', label: "What's next?", prompt: 'What should I watch next?' },
    { emoji: '😂', label: 'Something funny', prompt: 'Something funny under 90 min' },
    { emoji: '😱', label: 'Scary night', prompt: 'A scary horror movie' },
    { emoji: '🎲', label: 'Surprise me', prompt: 'Surprise me' },
];

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
    text: `Hi ${displayName}! I'm **CineBot**. Tell me a mood ("something funny under 90 min"), a title, or ask "what should I watch next?"`,
});

// Lightweight inline renderer: turns **bold** markdown into <strong> so the
// recommender's emphasis reads as intended instead of showing literal asterisks.
// Coerce to a string first — a bot message whose `text` is ever missing or a
// non-string (e.g. an unexpected backend payload) must never throw here, since
// CineBot renders app-wide and an uncaught error would blank the whole screen.
const renderRichText = (value) =>
    String(value ?? '').split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part) ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
        )
    );

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
    const inputRef = useRef(null);
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

    // Focus the input and wire up Escape-to-close while the panel is open.
    useEffect(() => {
        if (!isOpen) return;
        const t = setTimeout(() => inputRef.current?.focus(), 250);
        const onKey = (e) => e.key === 'Escape' && closeBot();
        window.addEventListener('keydown', onKey);
        return () => {
            clearTimeout(t);
            window.removeEventListener('keydown', onKey);
        };
    }, [isOpen, closeBot]);

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
            if (error || !data?.reply) {
                // Surface the reason so a silent downgrade to the local
                // recommender is diagnosable in devtools instead of invisible.
                console.warn('CineBot AI backend unavailable — using local recommender.', error || data);
                return null;
            }
            // Coerce/validate the payload: the backend is trusted but a schema
            // drift (older deploy, unexpected shape) must degrade gracefully, not
            // feed a non-string into render or build a broken /undefined/undefined link.
            const first = Array.isArray(data.items) ? data.items[0] : null;
            const link = first && (first.type === 'movie' || first.type === 'tv') && first.id != null
                ? `/${first.type}/${first.id}`
                : null;
            return { text: String(data.reply), link };
        } catch (err) {
            console.warn('CineBot AI call failed — using local recommender.', err);
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

    // Suggestion chips help first-timers start; drop them once the chat gets going.
    const showSuggestions = !isTyping && messages.length <= 1;

    return (
        <>
            {/* Floating launcher — hidden while the panel is open */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        key="cinebot-fab"
                        className="flex-center"
                        onClick={() => openBot()}
                        aria-label="Open CineBot assistant"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        style={{
                            position: 'fixed',
                            bottom: '96px',
                            right: '20px',
                            width: '58px',
                            height: '58px',
                            borderRadius: '50%',
                            background: 'var(--accent-gradient)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45)',
                            zIndex: 900,
                            cursor: 'pointer',
                            color: 'white',
                        }}
                    >
                        <Bot size={26} />
                        <Sparkles
                            size={13}
                            style={{ position: 'absolute', top: '11px', right: '11px', opacity: 0.9 }}
                        />
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            key="cinebot-backdrop"
                            className="cinebot-backdrop"
                            onClick={() => closeBot()}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        />
                        <motion.div
                            key="cinebot-panel"
                            className="cinebot-panel"
                            role="dialog"
                            aria-modal="true"
                            aria-label="CineBot assistant"
                            initial={{ opacity: 0, scale: 0.94, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 24 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        >
                            {/* Header */}
                            <div className="cinebot-header">
                                <div className="flex-center" style={{ gap: '11px' }}>
                                    <div className="cinebot-avatar" style={{ width: '40px', height: '40px' }}>
                                        <Bot size={22} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.2 }}>CineBot</h3>
                                        <div
                                            className="flex-center"
                                            style={{
                                                gap: '6px',
                                                justifyContent: 'flex-start',
                                                fontSize: '0.74rem',
                                                color: 'var(--text-secondary)',
                                                marginTop: '2px',
                                            }}
                                        >
                                            <span className="cinebot-status-dot" />
                                            Online · your movie guide
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="cinebot-close-btn"
                                    onClick={() => closeBot()}
                                    aria-label="Close CineBot"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Chat Area */}
                            <div className="cinebot-messages">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-end',
                                            gap: '8px',
                                            alignSelf: msg.isBot ? 'flex-start' : 'flex-end',
                                            flexDirection: msg.isBot ? 'row' : 'row-reverse',
                                            maxWidth: '90%',
                                        }}
                                    >
                                        {msg.isBot && (
                                            <div
                                                className="cinebot-avatar"
                                                style={{ width: '26px', height: '26px', marginBottom: '2px' }}
                                            >
                                                <Bot size={15} />
                                            </div>
                                        )}
                                        <div className={`cinebot-bubble ${msg.isBot ? 'bot' : 'user'}`}>
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{renderRichText(msg.text)}</div>
                                            {msg.link && (
                                                <button
                                                    className="cinebot-link-btn"
                                                    onClick={() => { navigate(msg.link); closeBot(); }}
                                                >
                                                    View details <ArrowUpRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}

                                {isTyping && (
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', alignSelf: 'flex-start' }}>
                                        <div className="cinebot-avatar" style={{ width: '26px', height: '26px' }}>
                                            <Bot size={15} />
                                        </div>
                                        <div
                                            className="cinebot-bubble bot flex-center"
                                            style={{ gap: '4px', padding: '14px' }}
                                            aria-label="CineBot is typing"
                                        >
                                            <span className="cinebot-dot" style={{ animationDelay: '0s' }} />
                                            <span className="cinebot-dot" style={{ animationDelay: '0.18s' }} />
                                            <span className="cinebot-dot" style={{ animationDelay: '0.36s' }} />
                                        </div>
                                    </div>
                                )}

                                {showSuggestions && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                                        {SUGGESTIONS.map((s) => (
                                            <button
                                                key={s.label}
                                                className="cinebot-chip"
                                                onClick={() => handleSend(s.prompt)}
                                            >
                                                {s.emoji} {s.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="cinebot-footer">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Mood, title, or 'what's next?'"
                                    className="cinebot-input"
                                    aria-label="Message CineBot"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                />
                                <motion.button
                                    className="cinebot-send-btn"
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isTyping}
                                    aria-label="Send message"
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <Send size={18} />
                                </motion.button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default CineBot;
