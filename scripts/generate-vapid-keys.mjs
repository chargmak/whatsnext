#!/usr/bin/env node
// Generate a VAPID key pair for Web Push.
//
//   node scripts/generate-vapid-keys.mjs
//
// - Put the PUBLIC key in the client env as VITE_VAPID_PUBLIC_KEY.
// - Set BOTH keys as edge-function secrets:
//     supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
// The private key is a secret — never commit it or expose it to the browser.

import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });

const b64u = (s) => Buffer.from(s, 'base64url');
const publicKey = Buffer.concat([Buffer.from([0x04]), b64u(jwk.x), b64u(jwk.y)]).toString('base64url');

console.log('VAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
