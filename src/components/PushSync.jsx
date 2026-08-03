import { useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { syncPushSubscription } from '../services/push';

// Keeps this device's push subscription alive on the server.
//
// A Web Push endpoint is not a one-time setup: the browser can rotate it, the
// push service can expire it, and the delivery jobs prune any endpoint that
// starts returning 404/410. Because the subscription row was only ever written
// from the Notifications toggle, losing it meant losing every scheduled alert —
// permanently and silently, since the toggle reads the browser's subscription
// and so kept reporting "on".
//
// Renders nothing; it just re-upserts the row on load, whenever the signed-in
// user changes, and when the service worker reports the browser rotated the
// subscription out from under us. It never prompts: with permission not yet
// granted, syncPushSubscription() is a no-op.
const PushSync = () => {
    const { user } = useUser();
    const userId = user?.id;

    useEffect(() => {
        if (!userId) return undefined;

        let active = true;
        const sync = () => {
            syncPushSubscription(userId).catch((err) => {
                // Best effort — a failed sync must never break app startup.
                console.warn('push subscription sync failed:', err?.message || err);
            });
        };
        sync();

        // sw.js posts this after re-subscribing in `pushsubscriptionchange`, so
        // the new endpoint reaches the server while the app is open rather than
        // waiting for the next cold start.
        const onMessage = (event) => {
            if (active && event.data?.type === 'push-subscription-changed') sync();
        };
        navigator.serviceWorker?.addEventListener('message', onMessage);

        return () => {
            active = false;
            navigator.serviceWorker?.removeEventListener('message', onMessage);
        };
    }, [userId]);

    return null;
};

export default PushSync;
