import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Frontend'den "/api" ile başlayan bir istek çıkarsa...
      '/api': {
        // ...bunu çaktırmadan Railway'deki canlı sunucuya yönlendir!
        target: 'https://pricetracker-production-b887.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})