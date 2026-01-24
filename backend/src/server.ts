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

// ✅ CORS MUST BE FIRST - before all middleware
app.use(cors({
  origin: [
    'https://shadowpayy.vercel.app',
    'https://shadowpay.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}))

app.options('*', cors())

// ✅ BODY PARSING MIDDLEWARE (after CORS)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// 🔍 DEBUG: Log all requests with body
app.use((req, _res, next) => {
  console.log('📥', req.method, req.url)
  console.log('📦 BODY:', req.body)
  next()
})



// --- Health ---
app.get('/health', (_req, res) => {
  const operatorSecret = process.env.OPERATOR_SECRET_KEY
  const dbUrl = process.env.DATABASE_URL
  
  res.status(200).json({
    status: 'ok',
    port: process.env.PORT,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    config: {
      DATABASE_URL: dbUrl ? '✓ Set' : '❌ Missing',
      OPERATOR_SECRET_KEY: operatorSecret ? '✓ Set' : '❌ Missing (required for claim/deposit)',
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ? '✓ Set' : '❌ Missing',
    },
  })
})

// --- API Routes ---
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/claim-link', claimLinkRouter)
app.use('/api/link', linkRouter)
app.use('/api/history', historyRouter)

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// 🚨 GLOBAL ERROR HANDLER (catch all errors)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ UNHANDLED ERROR:', err)
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    type: err.constructor.name,
  })
})

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
