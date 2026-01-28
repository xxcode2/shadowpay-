import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  plugins: [
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      'node-localstorage': path.resolve(__dirname, './src/empty-module.js'),
      path: path.resolve(__dirname, './src/empty-module.js'),
    },
  },
  build: {
    target: 'es2022',
  },
  optimizeDeps: {
    // ✅ PENTING: Exclude WASM packages dari pre-bundling
    exclude: ['@lightprotocol/hasher.rs', 'privacycash'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    // ✅ Serve node_modules so circuit files are accessible at /node_modules/...
    middlewareMode: true,
    fs: {
      allow: ['..', 'node_modules']
    }
  }
})

