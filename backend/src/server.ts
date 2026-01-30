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
import healthRouter from './routes/health.js'
import tokensRouter from './routes/tokens.js'
import savingsRouter from './routes/savings.js'

const app = express()

// ✅ STEP 1: CORS MUST BE FIRST - BEFORE ALL MIDDLEWARE
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
  maxAge: 86400, // 24 hours
}

// Custom CORS handler
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && corsOptions.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','))
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','))
    res.header('Access-Control-Max-Age', String(corsOptions.maxAge))
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  next()
})

// Also use cors package as backup
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// ✅ STEP 2: BODY PARSING
app.use(express.json())

// ✅ STEP 3: DATABASE AVAILABILITY CHECK MIDDLEWARE
const isDatabaseAvailable = () => !!process.env.DATABASE_URL

app.use('/api/savings', (req, res, next) => {
  if (!isDatabaseAvailable()) {
    console.warn(`⚠️  Request to ${req.path} but DATABASE_URL not set`)
    return res.status(503).json({ 
      error: 'Database service unavailable',
      message: 'DATABASE_URL environment variable not configured'
    })
  }
  next()
})

// ✅ STEP 3.5: HEALTH CHECK
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    port: process.env.PORT || 'not set',
    database: process.env.DATABASE_URL ? 'configured' : 'NOT CONFIGURED',
    timestamp: new Date().toISOString(),
  })
})

// ✅ STEP 4: API ROUTES
app.use('/api/create-link', createLinkRouter)
app.use('/api/deposit', depositRouter)
app.use('/api/claim-link', claimLinkRouter)
app.use('/api/withdraw', withdrawRouter)
app.use('/api/link', linkRouter)
app.use('/api/links', linksRouter)
app.use('/api/history', historyRouter)
app.use('/api/config', configRouter)
app.use('/api/health', healthRouter)
app.use('/api/tokens', tokensRouter)
app.use('/api/savings', savingsRouter)

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
