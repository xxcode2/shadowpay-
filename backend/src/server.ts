import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { ensureDbSchema } from './lib/ensureSchema.js'

dotenv.config()

console.log('═'.repeat(60))
console.log('🚀 STARTING SHADOWPAY BACKEND v2.0 (SIMPLIFIED - NO ENCRYPTION)')
console.log('═'.repeat(60))
console.log('NODE_ENV:', process.env.NODE_ENV || 'development')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '⚠️ Not set (DB operations will fail)')
console.log('Build: ' + new Date().toISOString())

// ✅ VALIDATE ENVIRONMENT AT STARTUP
async function validateEnvironment() {
  console.log('\n🔍 Validating environment variables...')
  
  const operatorKey = process.env.OPERATOR_SECRET_KEY
  if (!operatorKey) {
    console.error('❌ OPERATOR_SECRET_KEY not set')
    return
  }
  
  try {
    let keyArray: number[]
    if (operatorKey.startsWith('[') && operatorKey.endsWith(']')) {
      keyArray = JSON.parse(operatorKey)
    } else {
      keyArray = operatorKey
        .split(',')
        .map(num => parseInt(num.trim(), 10))
        .filter(num => !isNaN(num))
    }
    
    if (keyArray.length === 64) {
      console.log('✅ OPERATOR_SECRET_KEY format: VALID (64 elements)')
      
      // ✅ SHOW OPERATOR PUBLIC KEY (for topping up)
      try {
        const { Keypair } = await import('@solana/web3.js')
        const secretKey = Uint8Array.from(keyArray)
        const operatorKeypair = Keypair.fromSecretKey(secretKey)
        console.log(`\n💰 OPERATOR WALLET PUBLIC KEY:`)
        console.log(`   ${operatorKeypair.publicKey.toString()}\n`)
        console.log(`⚠️  SEND SOL TO THIS ADDRESS TO TOP UP OPERATOR WALLET`)
        console.log(`    Recommended: 0.1 SOL minimum for testing\n`)
      } catch (err) {
        console.error('Could not derive public key:', err)
      }
    } else {
      console.warn(`⚠️ OPERATOR_SECRET_KEY has ${keyArray.length} elements (should be 64)`)
    }
  } catch (err) {
    console.error('❌ OPERATOR_SECRET_KEY format: INVALID')
    console.error('  Error:', err instanceof Error ? err.message : String(err))
    console.error('  Format hint: Should be 64 comma-separated numbers, e.g., "232,221,205,...,23"')
  }
  
  console.log('')
}

import createLinkRouter from './routes/createLink.js'
import depositRouter from './routes/deposit.js'
import claimLinkRouter from './routes/claimLink.js'
import withdrawRouter from './routes/withdraw.js'
import linkRouter from './routes/link.js'
import linksRouter from './routes/links.js'
import historyRouter from './routes/history.js'
import configRouter from './routes/config.js'
import tokensRouter from './routes/tokens.js'
import incomingRouter from './routes/incoming.js'
import depositSPLRouter from './routes/depositSPL.js'
import withdrawSPLRouter from './routes/withdrawSPL.js'

// Privacy Cash model: UTXO-based ownership, not bearer links

const app = express()

// ✅ STEP 0: HANDLE ALL OPTIONS (PREFLIGHT) REQUESTS IMMEDIATELY
// This MUST be the VERY FIRST middleware - before ANYTHING else
app.options('*', (req, res) => {
  const origin = req.headers.origin as string
  const allowedOrigins = [
    'https://shadowpayy.vercel.app',
    'https://shadowpay.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ]

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  } else {
    res.header('Access-Control-Allow-Origin', '*')
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Max-Age', '86400')

  // Immediately return 200 for preflight
  return res.status(200).end()
})

// ✅ STEP 0.5: IMMEDIATE HEALTH CHECK (NO DEPENDENCIES)
// This endpoint must work even if the server is crashing on startup
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// ✅ STEP 1: CORS HEADERS FOR ALL OTHER REQUESTS
const corsOptions = {
  origin: [
    'https://shadowpayy.vercel.app',
    'https://shadowpay.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400,
}

app.use(cors(corsOptions))

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin as string
  if (origin && corsOptions.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  next()
})

// ✅ STEP 2: BODY PARSING
app.use(express.json())

// ✅ STEP 3: DATABASE AVAILABILITY CHECK
const isDatabaseAvailable = () => !!process.env.DATABASE_URL

// ✅ STEP 4: API ROUTES
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/deposit-spl', depositSPLRouter)
app.use('/api/claim-link', claimLinkRouter)
app.use('/api/withdraw', withdrawRouter)
app.use('/api/withdraw-spl', withdrawSPLRouter)
app.use('/api/link', linkRouter)
app.use('/api/links', linksRouter)
app.use('/api/history', historyRouter)
app.use('/api/config', configRouter)
// Health check is now directly on app.get('/health') and app.get('/api/health')
// app.use('/api/health', healthRouter)  // Disabled - using simpler health checks
app.use('/api/tokens', tokensRouter)
app.use('/api/incoming', incomingRouter)

// Privacy Cash model (CORRECTED):
// - Sender deposits with recipient as owner
// - Recipient decrypts and withdraws
// - No operator withdrawal, no escrow

// ✅ STEP 5: 404 HANDLER - Must come AFTER routes
app.use((_req: express.Request, res: express.Response) => {
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

// ✅ STEP 7: ENSURE DATABASE SCHEMA - Run before listening
async function startServer() {
  const hasDatabaseUrl = !!process.env.DATABASE_URL
  
  if (!hasDatabaseUrl) {
    console.warn('\n⚠️  DATABASE_URL NOT SET - Running in API-only mode')
    console.warn('   Database operations will return 503 Service Unavailable')
    console.warn('   Set DATABASE_URL environment variable to enable database features\n')
  } else {
    try {
      await validateEnvironment()
      // Run schema check with timeout - don't block server startup
      Promise.race([
        ensureDbSchema(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Schema check timeout')), 5000)
        )
      ]).catch(err => {
        console.warn('⚠️  Schema check failed/timeout:', err.message)
        // Continue anyway - let Prisma handle it
      })
    } catch (err: any) {
      console.error('⚠️  Validation failed:', err.message)
      // Continue anyway
    }
  }

  // ✅ STEP 7.5: SETUP OPERATOR BALANCE MONITORING
  try {
    const { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } = await import('@solana/web3.js')
    
    const operatorKey = process.env.OPERATOR_SECRET_KEY
    if (operatorKey) {
      const parseSecretKey = (key: string): Uint8Array | null => {
        try {
          if (key.startsWith('[') && key.endsWith(']')) {
            return Uint8Array.from(JSON.parse(key))
          }
          const nums = key.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
          return nums.length === 64 ? Uint8Array.from(nums) : null
        } catch {
          return null
        }
      }
      
      const secretKey = parseSecretKey(operatorKey)
      if (secretKey) {
        const operatorKeypair = Keypair.fromSecretKey(secretKey)
        const network = process.env.SOLANA_NETWORK || 'mainnet'
        const rpcUrl = process.env.SOLANA_RPC || 
          (network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com')
        const connection = new Connection(rpcUrl, 'confirmed')
        
        // Run initial check
        ;(async () => {
          try {
            const balance = await connection.getBalance(operatorKeypair.publicKey)
            const balanceSOL = balance / LAMPORTS_PER_SOL
            console.log(`💰 Operator balance: ${balanceSOL.toFixed(4)} SOL`)
            
            if (balanceSOL < 0.01) {
              console.error('⚠️ WARNING: Operator balance critically low!')
            } else if (balanceSOL < 0.05) {
              console.warn('⚠️ CAUTION: Operator balance running low')
            }
          } catch (err) {
            console.warn('Could not fetch operator balance:', err instanceof Error ? err.message : 'Unknown error')
          }
        })()
        
        // Setup hourly monitoring
        setInterval(async () => {
          try {
            const balance = await connection.getBalance(operatorKeypair.publicKey)
            const balanceSOL = balance / LAMPORTS_PER_SOL
            
            if (balanceSOL < 0.01) {
              console.error(`\n🚨 CRITICAL: Operator balance is ${balanceSOL.toFixed(4)} SOL (< 0.01 SOL)`)
              console.error(`   Please top up: ${operatorKeypair.publicKey.toString()}\n`)
            } else if (balanceSOL < 0.05) {
              console.warn(`\n⚠️  WARNING: Operator balance is ${balanceSOL.toFixed(4)} SOL (< 0.05 SOL)\n`)
            }
          } catch (err) {
            console.warn('Balance monitoring error:', err instanceof Error ? err.message : 'Unknown error')
          }
        }, 3600000) // Check every hour
      }
    }
  } catch (err: any) {
    console.warn('⚠️  Balance monitoring setup failed:', err.message)
  }

  // ✅ STEP 8: LISTEN
  const PORT = Number(process.env.PORT) || 3001
  
  if (!process.env.PORT) {
    console.warn(`⚠️  PORT env not set, using default: ${PORT}`)
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend listening on port ${PORT}`)
  })

  server.on('error', (error: any) => {
    console.error('❌ Server error:', error.message)
    process.exit(1)
  })
}

// Start server
startServer().catch((err) => {
  console.error('❌ Failed to start server:', err)
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
