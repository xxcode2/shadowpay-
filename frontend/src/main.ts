import process from 'process'
import { Buffer } from 'buffer'

globalThis.process = process
globalThis.Buffer = Buffer

import { App } from './app'

const app = new App()
app.init()
