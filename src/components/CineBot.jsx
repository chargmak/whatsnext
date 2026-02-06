import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchMulti } from '../services/tmdb';

const CineBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Hi Dimitrios! I'm CineBot. Tell me what you're in the mood for (e.g., 'Batman', 'Comedy', 'Dune').", isBot: true }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userText = input;
        const userMsg = { id: Date.now(), text: userText, isBot: false };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        try {
            // 1. Simple Keyword Checks (Mock "personality")
            const lowerInput = userText.toLowerCase();
            let botResponse = null;
            let recommendedPath = null;

            if (lowerInput.includes('hello') || lowerInput.includes('hi ')) {
                botResponse = "Hello! Ready to find a movie?";
            } else {
                // 2. Real TMDB Search
                const data = await searchMulti(userText);
                const bestMatch = data?.results?.find(item => item.media_type === 'movie' || item.media_type === 'tv');

                if (bestMatch) {
                    const title = bestMatch.title || bestMatch.name;
                    const type = bestMatch.media_type;
                    const year = (bestMatch.release_date || bestMatch.first_air_date)?.split('-')[0] || '';

                    botResponse = `I found "**${title}**" (${year}). \n\n${bestMatch.overview?.substring(0, 100)}...`;
                    recommendedPath = `/${type}/${bestMatch.id}`;
                } else {
                    botResponse = "I couldn't find anything matching that. Try a different title?";
                }
            }

            // Simulate "thinking" delay
            setTimeout(() => {
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now() + 1,
                        text: botResponse,
                        isBot: true,
                        link: recommendedPath
                    }
                ]);
                setIsTyping(false);
            }, 1000);

        } catch (error) {
            console.error("Bot Error", error);
            setIsTyping(false);
        }
    };

    return (
        <>
            <motion.button
                className="flex-center"
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    position: 'fixed',
                    bottom: '160px',
                    right: '20px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '28px',
                    background: 'var(--accent-gradient)', // Uses new red gradient
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.5)', // Red shadow
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
                            // Removed opaque background, handled by glass-panel
                            borderRadius: 'var(--radius-lg)',
                            // Border handled by glass-panel
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
                                onClick={() => setIsOpen(false)}
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
                                            onClick={() => { navigate(msg.link); setIsOpen(false); }}
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
                                placeholder="Type a movie or show..."
                                className="input-field"
                                style={{ borderRadius: '24px', padding: '10px 16px' }}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={handleSend}
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
