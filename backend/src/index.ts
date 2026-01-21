import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

import depositRoute from './routes/deposit.js'
import withdrawRoute from './routes/withdraw.js'
import linkRoute from './routes/link.js'

const app = express()

// 🔥 CORS PALING ATAS
app.use(
  cors({
    origin: 'https://shadowpayy.vercel.app',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// 🔥 HANDLE PREFLIGHT EXPLICIT
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://shadowpayy.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.sendStatus(200)
})

app.use(express.json())

app.use('/api/deposit', depositRoute)
app.use('/api/withdraw', withdrawRoute)
app.use('/api/link', linkRoute)

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`🚀 Backend running on ${PORT}`)
})
