import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import createLinkRouter from './routes/createLink.js'

dotenv.config()

console.log('🚀 Starting ShadowPay Backend...')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing')

// Import routes AFTER config is loaded
import depositRouter from './routes/deposit.js'
import withdrawRouter from './routes/withdraw.js'
import linkRouter from './routes/link.js'

const app = express()

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

// Handle preflight explicitly (THIS IS KEY)
app.options('*', cors())

app.use(express.json())

// --- API Routes ---
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/withdraw', withdrawRouter)
app.use('/api/link', linkRouter)

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),
  })
})

// --- Global Error Handler ---
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err)
    res.status(500).json({
      error: 'Internal server error',
    })
  }
)

// --- START SERVER (RAILWAY SAFE) ---
const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ShadowPay Backend running on port ${PORT}`)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})
