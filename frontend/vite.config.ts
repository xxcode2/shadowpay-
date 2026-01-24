import { defineConfig } from 'vite'
import rollupNodePolyFill from 'rollup-plugin-polyfill-node'

export default defineConfig({
  plugins: [rollupNodePolyFill()],

  define: {
    global: 'globalThis',
    'process.env': {}, // 🔥 PENTING
  },

  resolve: {
    alias: {
      process: 'process/browser',
      buffer: 'buffer',
    },
  },

  optimizeDeps: {
    include: ['buffer', 'process'],
  },

  build: {
    target: 'es2022',
  },

  server: {
    port: 5173,
  },
})
