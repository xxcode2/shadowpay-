import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process'],
    }),
  ],

  define: {
    global: 'globalThis',
    'process.env': {},
  },

  resolve: {
    alias: {
      buffer: 'buffer/',
      process: 'process/browser',
    },
  },

  build: {
    target: 'es2022',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
