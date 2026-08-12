// Web Push subscription helpers.
//
// Flow: request Notification permission -> subscribe the page's service worker to
// the browser Push service using our VAPID public key -> store the resulting
// subscription in Supabase so the `send-release-reminders` edge function can
// deliver alerts. Guests (no account) can grant permission, but their reminders
// live only in localStorage, so scheduled server pushes require signing in.

import { supabase } from './supabase';

// VAPID public key. Safe to ship to the browser — it only identifies which
// server may push to a subscription; the matching PRIVATE key stays an edge
// secret (see NOTIFICATIONS_SETUP.md). A build-time env var (Vercel) overrides
// this default so the key can be rotated without a code change; the baked
// default keeps push notifications enabled even when the env var is unset.
const VAPID_PUBLIC_KEY =
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    'BEiuMR6fPv2p9L2n712L-PTP6Eot_iOiWAk8wrIcZ-54C9SX1aDFfVZZ9VB_-cTzRSuUjjZ3ww5lybJem75rogI';

export const pushSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

export const pushConfigured = () => Boolean(VAPID_PUBLIC_KEY);

export const getPermission = () =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default';

// VAPID public key (base64url) -> Uint8Array for applicationServerKey.
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
};

// sw.js is registered in main.jsx; wait until it controls the page.
const getRegistration = () => navigator.serviceWorker.ready;

export const isSubscribed = async () => {
    if (!pushSupported()) return false;
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
};

const saveSubscription = async (userId, subscription) => {
    // No account (guest / signed-out): permission is granted and the browser is
    // subscribed, but there is no server-side row to push to.
    if (!supabase || !userId) return;
    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
        {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
            user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
    );
    if (error) throw error;
};

// Does an existing subscription belong to the VAPID key we push with today?
// A subscription is bound to the applicationServerKey it was created with, so
// after a key rotation (or one left over from an older deployment) the push
// service rejects our sends with 403 VapidPkHashMismatch — silently, from the
// user's side. Such a subscription has to be replaced, not reused.
const matchesServerKey = (subscription) => {
    const raw = subscription.options?.applicationServerKey;
    // Some browsers don't expose the key back; nothing to check against.
    if (!raw) return true;
    const current = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const existing = new Uint8Array(raw);
    return existing.length === current.length && existing.every((b, i) => b === current[i]);
};

const subscribeBrowser = (reg) =>
    reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

// Is the browser's current subscription the one the server would push to?
// The toggle reflects the browser, which can say "on" long after the server-side
// row is gone — that gap is exactly how delivery dies unnoticed.
export const isRegisteredOnServer = async (userId) => {
    if (!pushSupported() || !supabase || !userId) return false;
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint)
        .maybeSingle();
    if (error) return false;
    return Boolean(data);
};

// Re-assert this device's subscription, idempotently. Called on every app load
// for a signed-in user, because a subscription granted once does NOT stay
// registered on its own:
//
//   * Push services retire endpoints by themselves (browser update, PWA
//     reinstall, storage pressure, weeks idle). The edge functions prune the
//     dead row on the resulting 404/410, and nothing ever wrote a new one — the
//     toggle still reads "on" while no notification can ever arrive again.
//   * Subscribing as a guest leaves the browser subscribed with no row to
//     attach it to; signing in later never revisited it.
//   * A rotated VAPID key leaves a subscription we're no longer allowed to push to.
//
// Permission is already granted in all of these cases, so re-subscribing is
// silent — no prompt, nothing for the user to do. Failures are logged, never
// thrown: this runs in the background and must not break app startup.
export const syncPushSubscription = async (userId) => {
    if (!pushSupported() || !pushConfigured()) return false;
    if (!supabase || !userId) return false;
    if (getPermission() !== 'granted') return false;

    try {
        const reg = await getRegistration();
        let subscription = await reg.pushManager.getSubscription();

        if (subscription && !matchesServerKey(subscription)) {
            const stale = subscription.endpoint;
            await subscription.unsubscribe().catch(() => {});
            await supabase.from('push_subscriptions').delete().eq('endpoint', stale);
            subscription = null;
        }

        if (!subscription) subscription = await subscribeBrowser(reg);

        await saveSubscription(userId, subscription);
        return true;
    } catch (err) {
        console.error('Push subscription sync failed:', err);
        return false;
    }
};

export const subscribeToPush = async (userId) => {
    if (!pushSupported()) {
        throw new Error('Push notifications are not supported on this device or browser.');
    }
    if (!pushConfigured()) {
        throw new Error('Push notifications are not configured for this deployment.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error(
            permission === 'denied'
                ? 'Notifications are blocked. Enable them for this site in your browser settings.'
                : 'Notification permission was not granted.'
        );
    }

    const reg = await getRegistration();
    let subscription = await reg.pushManager.getSubscription();
    // Reusing a subscription bound to a different VAPID key would leave the
    // toggle on while every send is refused — replace it instead.
    if (subscription && !matchesServerKey(subscription)) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
    }
    if (!subscription) subscription = await subscribeBrowser(reg);
    await saveSubscription(userId, subscription);
    return subscription;
};

export const unsubscribeFromPush = async (userId) => {
    if (!pushSupported()) return;
    const reg = await getRegistration();
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    if (supabase && userId) {
        await supabase.from('push_subscriptions').delete().match({ user_id: userId, endpoint });
    }
};
