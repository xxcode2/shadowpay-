import { defineConfig } from 'vite'
import { Buffer } from 'buffer'

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'buffer': 'buffer',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
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
