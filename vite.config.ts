import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Orbit',
        short_name: 'Orbit',
        description: 'Self-paced interactive lessons in CS, engineering, mathematics, and physics.',
        theme_color: '#4338ca',
        background_color: '#0d1020',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Pyodide is large: cache it the first time it is used rather than up front.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/pyodide/'),
            handler: 'CacheFirst',
            options: { cacheName: 'pyodide', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
