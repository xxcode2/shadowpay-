import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Load env first
dotenv.config()

// Routes
import depositRoute from './routes/deposit.js'
import withdrawRoute from './routes/withdraw.js'
import linkRoute from './routes/link.js'

// --- App ---
const app = express()

// --- CORS (HARUS DI PALING ATAS) ---
app.use(
  cors({
    origin: [
      'https://shadowpayy.vercel.app',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
)

// Handle preflight explicitly (INI KUNCI)
app.options('*', cors())

// --- Body parser ---
app.use(express.json())

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'shadowpay-backend',
    time: new Date().toISOString(),
  })
})

// --- API Routes ---
app.use('/api/deposit', depositRoute)
app.use('/api/withdraw', withdrawRoute)
app.use('/api/link', linkRoute)

// --- Error fallback ---
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('❌ Unhandled error:', err)
    res.status(500).json({
      error: 'Internal server error',
    })
  }
)

// --- Start server ---
const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`🚀 ShadowPay backend running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})
