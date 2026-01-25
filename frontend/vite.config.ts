import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  plugins: [
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      // Prevent node-localstorage from being loaded in browser
      // It tries to use fs.statSync which doesn't exist in browser
      'node-localstorage': path.resolve(__dirname, './src/empty-module.js'),
    },
  },
  build: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
