import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import depositRouter from './routes/deposit.js'
import withdrawRouter from './routes/withdraw.js'
import linkRouter from './routes/link.js'

dotenv.config()

const app = express()

// --- CORS ---
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://shadowpay.vercel.app',
      'https://shadowpayy.vercel.app',
    ],
    credentials: true,
  })
)

app.use(express.json())

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),
  })
})

// --- API Routes ---
app.use('/api/deposit', depositRouter)
app.use('/api/withdraw', withdrawRouter)
app.use('/api/link', linkRouter)

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
  console.log(`🚀 ShadowPay Backend running on port ${PORT}`)
})
