import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

console.log('🚀 Starting ShadowPay Backend...')
console.log('NODE_ENV:', process.env.NODE_ENV || 'development')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '⚠️ Not set (DB operations will fail)')

import createLinkRouter from './routes/createLink.js'
import depositRouter from './routes/deposit.js'
import claimLinkRouter from './routes/claimLink.js'
import linkRouter from './routes/link.js'
import historyRouter from './routes/history.js'

const app = express()

// --- MIDDLEWARE ---
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// 🔍 DEBUG: Log all requests with body
app.use((req, _res, next) => {
  console.log('📥', req.method, req.url)
  console.log('📦 BODY:', req.body)
  next()
})

// --- CORS ---
app.use(
  cors({
    origin: [
      'https://shadowpayy.vercel.app',
      'https://shadowpay.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
)

app.options('*', cors())
app.use(express.json())

// --- Health ---
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    port: process.env.PORT,
    timestamp: new Date().toISOString(),
  })
})

// --- API Routes ---
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/claim-link', claimLinkRouter)
app.use('/api/link', linkRouter)
app.use('/api/history', historyRouter)

// 🚨 CRITICAL: MUST USE RAILWAY PORT (8080)
const PORT = Number(process.env.PORT)

if (!PORT) {
  console.error('❌ PORT env not set - Railway must provide PORT=8080')
  process.exit(1)
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend listening on port ${PORT}`)
})

server.on('error', (error: any) => {
  console.error('❌ Failed to bind port', PORT, ':', error.message)
  process.exit(1)
})
