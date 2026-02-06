import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    style={{
                        position: 'fixed',
                        bottom: '90px',
                        left: '16px',
                        right: '16px',
                        zIndex: 1000,
                        maxWidth: '500px',
                        margin: '0 auto'
                    }}
                >
                    <div
                        className="glass-panel"
                        style={{
                            padding: '20px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--brand-600)',
                            boxShadow: '0 8px 32px rgba(220, 38, 38, 0.3)',
                            background: 'rgba(20, 20, 21, 0.95)',
                            backdropFilter: 'blur(20px)'
                        }}
                    >
                        <button
                            onClick={handleDismiss}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--brand-600)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                <Download size={32} color="white" />
                            </div>

                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>
                                    Install What's Next?
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Install our app for quick access and offline features
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleInstall}
                            className="btn"
                            style={{
                                width: '100%',
                                marginTop: '16px',
                                background: 'var(--brand-600)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <Download size={18} />
                            Install App
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default InstallPrompt;
