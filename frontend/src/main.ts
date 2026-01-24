import { Buffer } from 'buffer'

// Polyfill Buffer untuk browser SEBELUM import lain
globalThis.Buffer = Buffer
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Buffer = Buffer
}

import { App } from './app'

const app = new App()
await app.init()
