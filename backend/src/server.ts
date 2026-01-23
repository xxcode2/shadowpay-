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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// --- API Routes ---
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/claim-link', claimLinkRouter)
app.use('/api/link', linkRouter)

// --- START SERVER (🔥 RAILWAY SAFE) ---
const PORT = process.env.PORT || '3000'

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 ShadowPay backend listening on port ${PORT}`)
})
