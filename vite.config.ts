
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'MDU Fibre Survey',
        short_name: 'MDU Survey',
        description: 'MDU Fibre Site Survey and Design',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0b5394',
        background_color: '#ffffff',

        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },

      workbox: {
        navigateFallback: '/index.html',

        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}',
        ],

        runtimeCaching: [
          {
            urlPattern: /\/api\/(buildings|lookups)(\/|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'master-data',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

server: {
  proxy: {
    '/api': {
      target: 'https://g1v28jg8-5204.inc1.devtunnels.ms/',
      changeOrigin: true,
      secure: true,
    },
  },
},
});
 