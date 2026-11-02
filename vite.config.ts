/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kintore Memo',
        short_name: 'Kintore Memo',
        description: 'Workout and cardio log',
        lang: 'en',
        start_url: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2383e2',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'] },
    }),
  ],
  test: { environment: 'node' },
})
