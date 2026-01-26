import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  plugins: [
    nodePolyfills({
      protocolImports: true,
      globals: {
        // ✅ MOCK CONSOLE untuk browser - SDK mencoba write ke stdout
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // Prevent node-localstorage from being loaded in browser
      // It tries to use fs.statSync which doesn't exist in browser
      'node-localstorage': path.resolve(__dirname, './src/empty-module.js'),
      // ✅ MOCK PATH MODULE untuk browser - SDK mencoba gunakan path.join()
      path: path.resolve(__dirname, './src/empty-module.js'),
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
