import { defineConfig } from 'vite'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
        NodeModulesPolyfillPlugin(),
      ],
    },
  },

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
