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

const app = express()

// ✅ STEP 1: CORS MUST BE FIRST - BEFORE ALL MIDDLEWARE
const corsOptions = {
  origin: [
    'https://shadowpayy.vercel.app',
    'https://shadowpay.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// ✅ STEP 2: BODY PARSING
app.use(express.json())

// ✅ STEP 3: HEALTH CHECK
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    port: process.env.PORT,
    timestamp: new Date().toISOString(),
  })
})

// ✅ STEP 4: API ROUTES
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/claim-link', claimLinkRouter)
app.use('/api/link', linkRouter)

// ✅ STEP 5: 404 HANDLER - Must come AFTER routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ✅ STEP 6: GLOBAL ERROR HANDLER - Must be LAST middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ UNHANDLED ERROR:', err)
  
  // Don't crash on error - always send response
  if (!res.headersSent) {
    res.status(500).json({
      error: err.message || 'Internal Server Error',
      type: err.constructor.name,
    })
  }
})

// ✅ STEP 7: LISTEN
const PORT = Number(process.env.PORT)

if (!PORT) {
  console.error('❌ PORT env not set')
  process.exit(1)
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend listening on port ${PORT}`)
})

server.on('error', (error: any) => {
  console.error('❌ Server error:', error.message)
  process.exit(1)
})

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ UNHANDLED REJECTION:', reason)
})

process.on('uncaughtException', (err: any) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err)
  process.exit(1)
})
