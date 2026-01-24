import { Buffer } from 'buffer'

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Buffer = Buffer
}

import { App } from './app'

const app = new App()
await app.init()
