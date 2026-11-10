import React, { useEffect, useRef } from 'react';
import '../styles/account.css';

// Bottom sheet asked once after login / sign-up when this device still holds
// guest data. It is a plain props component (UserContext renders it), so it
// must not import the context itself.
//
// There is deliberately no backdrop-click or Escape dismissal: the answer is
// remembered either way, so the user has to pick one of the two buttons.
const ImportGuestSheet = ({ watchlistCount = 0, watchedCount = 0, onImport, onSkip }) => {
    const sheetRef = useRef(null);
    const primaryRef = useRef(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        primaryRef.current?.focus();

        // Keep the page behind the sheet from scrolling while it is open.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Keep Tab inside the sheet, and swallow Escape so it can't act as a
        // silent "no". Listening on the document covers the case where focus
        // has landed on the page body (e.g. after a tap on the backdrop).
        const handleKeyDown = (e) => {
            const sheet = sheetRef.current;
            if (!sheet) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.key !== 'Tab') return;
            const focusable = sheet.querySelectorAll('button:not([disabled])');
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const inside = sheet.contains(document.activeElement);
            if (e.shiftKey && (!inside || document.activeElement === first)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, []);

    return (
        <div className="modal-overlay">
            <section
                ref={sheetRef}
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-guest-title"
                aria-describedby="import-guest-desc"
            >
                <span className="modal-handle" aria-hidden="true"></span>
                <h2 id="import-guest-title" className="account-sheet-title">Bring your guest data along?</h2>
                <p id="import-guest-desc" className="account-sheet-text">
                    Import the watchlist and watched history saved on this device into your account.
                </p>

                <div className="bento">
                    <div className="account-count">
                        <span className="tile-label">Watchlist</span>
                        <span className="account-count-value">{watchlistCount.toLocaleString()}</span>
                    </div>
                    <div className="account-count">
                        <span className="tile-label">Watched</span>
                        <span className="account-count-value">{watchedCount.toLocaleString()}</span>
                    </div>
                </div>

                <div className="account-actions">
                    <button
                        ref={primaryRef}
                        type="button"
                        className="pill-btn primary lg block"
                        onClick={onImport}
                    >
                        Import to my account
                    </button>
                    <button type="button" className="account-text-btn" onClick={onSkip}>
                        Not now
                    </button>
                </div>
                <p className="account-sheet-note">We won't ask again if you skip this.</p>
            </section>
        </div>
    );
};

export default ImportGuestSheet;
