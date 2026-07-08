// Web Push subscription helpers.
//
// Flow: request Notification permission -> subscribe the page's service worker to
// the browser Push service using our VAPID public key -> store the resulting
// subscription in Supabase so the `send-release-reminders` edge function can
// deliver alerts. Guests (no account) can grant permission, but their reminders
// live only in localStorage, so scheduled server pushes require signing in.

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    if (supabase && userId) {
        await supabase.from('push_subscriptions').delete().match({ user_id: userId, endpoint });
    }
};
