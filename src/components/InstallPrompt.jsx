import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/account.css';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // Only show if not previously dismissed
            const isDismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true';
            if (!isDismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        console.log(`User response to the install prompt: ${outcome}`);

        // Clear the deferredPrompt
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Permanently dismiss
        localStorage.setItem('pwa-prompt-dismissed', 'true');
    };

    // Dismissal check moved to main handler

    return (
        <AnimatePresence>
            {showPrompt && deferredPrompt && (
                <motion.div
                    className="account-install-wrap"
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                    <section className="account-install" aria-label="Install the app">
                        <div className="account-install-body">
                            <h3 className="account-install-title">Install What's Next?</h3>
                            <p className="account-install-text">Quick access and offline features</p>
                        </div>
                        <button type="button" onClick={handleInstall} className="pill-btn primary">
                            Install
                        </button>
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="icon-btn bare"
                            aria-label="Dismiss"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </section>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default InstallPrompt;
