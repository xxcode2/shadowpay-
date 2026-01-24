import { Buffer } from 'buffer'

// Polyfill Buffer for browser (Solana Web3.js needs this)
globalThis.Buffer = Buffer

import { App } from './app'

const app = new App()
await app.init()
