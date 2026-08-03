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

// sw.js is registered in main.jsx; wait until it controls the page. If
// registration failed, `ready` never settles — so callers get a null after a
// short wait instead of a promise that hangs for the life of the page.
const getRegistration = () =>
    Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);

export const isSubscribed = async () => {
    if (!pushSupported()) return false;
    const reg = await getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
};

// The full picture, because "is this device subscribed?" has two halves that can
// disagree. `subscribed` is the browser's own Push subscription; `serverLinked`
// is whether a matching row exists in push_subscriptions for this account. The
// scheduled jobs can only push to the row — a device that is subscribed but not
// linked receives nothing, which is exactly how alerts went quiet without the
// toggle ever looking "off".
export const pushStatus = async (userId) => {
    const base = { supported: false, permission: 'default', subscribed: false, serverLinked: false };
    if (!pushSupported()) return base;

    const permission = getPermission();
    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub || !supabase || !userId) {
        return { ...base, supported: true, permission, subscribed: Boolean(sub) };
    }

    const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint)
        .maybeSingle();

    return { supported: true, permission, subscribed: true, serverLinked: Boolean(data) };
};

// Re-establish this device's server-side subscription, without prompting.
//
// Push endpoints are not permanent: browsers rotate them, push services expire
// them, and the delivery jobs prune any endpoint that comes back 404/410. When
// that happens the row is gone for good and nothing recreates it — the user is
// still "subscribed" as far as the browser and the UI are concerned, but every
// scheduled alert silently has nowhere to go. The same gap swallows a
// subscription made while signed out: no account, so no row was ever written.
//
// So on every app load (and whenever the signed-in user changes) we re-mint the
// browser subscription if it went missing and re-upsert the row. Permission is
// already granted at this point, so `subscribe()` cannot show a prompt.
export const syncPushSubscription = async (userId) => {
    if (!pushSupported() || !pushConfigured()) return { status: 'unsupported' };
    if (getPermission() !== 'granted') return { status: 'no-permission' };

    const reg = await getRegistration();
    if (!reg) return { status: 'no-service-worker' };

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
    }

    if (!supabase || !userId) return { status: 'signed-out', subscription };
    await saveSubscription(userId, subscription);
    return { status: 'synced', subscription };
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
    if (!reg) {
        throw new Error('The app\'s background worker isn\'t running yet. Reload the page and try again.');
    }
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
    }
    await saveSubscription(userId, subscription);
    return subscription;
};

export const unsubscribeFromPush = async (userId) => {
    if (!pushSupported()) return;
    const reg = await getRegistration();
    if (!reg) return;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    if (supabase && userId) {
        await supabase.from('push_subscriptions').delete().match({ user_id: userId, endpoint });
    }
};
