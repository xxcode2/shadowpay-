import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'ES2022',
    outDir: 'dist'
  }
})
