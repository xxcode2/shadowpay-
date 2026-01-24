import { Buffer } from 'buffer'
import process from 'process'

globalThis.Buffer = Buffer
globalThis.process = process

import { App } from './app'

const app = new App()
app.init()
