import { App } from './app'

const app = new App()
app.init()

// Expose globally for inline event handlers
window.shadowpay = app
