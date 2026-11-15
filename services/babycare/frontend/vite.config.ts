import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/babycare/',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/babycare/v1': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true
      }
    }
  }
})
