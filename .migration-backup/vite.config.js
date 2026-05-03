import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      proxy: {
        // Forward /api/* to the Vercel CLI dev server (vercel dev runs on 3001 by
        // default).  If VITE_API_BASE is set to a different origin, that's used.
        // Falls back to the same origin in production (no proxy needed there).
        '/api': {
          target: process.env.VITE_API_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  })
  