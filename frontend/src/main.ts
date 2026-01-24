import { Buffer } from 'buffer'

// Polyfill Buffer for browser (Solana Web3.js needs this)
if (!(window as any).Buffer) {
  ;(window as any).Buffer = Buffer
}

import { App } from './app'

const app = new App()
await app.init()
