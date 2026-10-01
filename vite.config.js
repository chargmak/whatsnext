import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Keep the big, rarely-changing libraries in their own hashed chunks. Every
// app change used to rebuild one ~400 KB bundle, so returning visitors
// re-downloaded React and framer-motion each deploy; split out, those chunks
// stay cached (the service worker keeps /assets/ cache-first) and only the
// small app chunk changes. Matched on the package directory so a library's
// internal helper packages (motion-dom, scheduler, …) travel with it.
const VENDOR_CHUNKS = [
  ['react', [/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//]],
  ['motion', [/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//]],
  ['supabase', [/\/node_modules\/@supabase\//]],
]

const manualChunks = (id) => {
  for (const [name, patterns] of VENDOR_CHUNKS) {
    if (patterns.some((pattern) => pattern.test(id))) return name
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  // basicSsl only affects the dev/preview server: service workers and Web Push
  // need a secure origin, and this lets phones on the LAN exercise them.
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    https: true
  },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
})
