import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
   build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5177,
    proxy: {
      '/api/nova': {
        target: 'https://api.nova.amazon.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nova/, '')
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 8082
  }
})
