import React, { createContext, useContext, useState } from 'react';

const CineBotContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCineBot = () => {
    const context = useContext(CineBotContext);
    if (!context) {
        throw new Error('useCineBot must be used within CineBotProvider');
    }
    return context;
};

// Lifts CineBot's open state so any screen (e.g. the Home "What's Next?" widget)
// can open the assistant and optionally auto-send a prompt through CineBot's own
// send pipeline. Mount high enough to enclose both the routed pages and <CineBot />.
export const CineBotProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [pendingPrompt, setPendingPrompt] = useState(null);

    // Open the panel; pass a prompt to also auto-send it once the panel mounts.
    const openBot = (prompt = null) => {
        if (typeof prompt === 'string' && prompt.trim()) setPendingPrompt(prompt);
        setIsOpen(true);
    };

    const closeBot = () => setIsOpen(false);

    // CineBot calls this after it has picked up the prompt, so it fires exactly once.
    const consumePrompt = () => setPendingPrompt(null);

    return (
        <CineBotContext.Provider value={{ isOpen, pendingPrompt, openBot, closeBot, consumePrompt }}>
            {children}
        </CineBotContext.Provider>
    );
};
