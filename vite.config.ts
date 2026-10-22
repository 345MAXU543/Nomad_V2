import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './', 
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Nomad 作戰中心',
        short_name: 'Nomad',
        description: '個人音樂教學管理系統',
        theme_color: '#001529',
        background_color: '#001529',
        display: 'standalone',
        scope: './',
        start_url: './',
        icons: [
          { src: 'MainIcon.jpg', sizes: '192x192 512x512', type: 'image/jpeg', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
