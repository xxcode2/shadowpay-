import { Router, Request, Response } from 'express'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { loadKeypairFromEnv } from '../services/keypairManager.js'
import { initializePrivacyCash } from '../services/privacyCash.js'

const router = Router()

/**
 * ✅ BACKEND-ASSISTED DEPOSIT - USER PAYS FEES
 * 
 * Flow:
 * 1. Backend: Use operator keypair to initialize SDK (proof generation only)
 * 2. Backend: Generate ZK proof
 * 3. Backend: Create transaction but set USER as fee payer ← Critical!
 * 4. Backend → Frontend: Return unsigned transaction
 * 5. Frontend: User signs transaction with Phantom
 * 6. Frontend: Submit signed transaction to blockchain (USER PAYS)
 * 7. Frontend → Backend: Send transaction signature
 * 8. Backend: Record transaction
 * 
 * Result: Operator generates proof, USER signs and pays everything!
 */

interface PrepareDepositRequest {
  linkId: string
  amount: string
  publicKey: string
  lamports: number
}

interface DepositRecordRequest {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  signedTransaction: string
}

/**
 * DEBUG: Enhanced health check with detailed diagnostics
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    console.log(`\n🏥 DEPOSIT SERVICE HEALTH CHECK`)
    
    const checks: any = {
      timestamp: new Date().toISOString(),
      service: 'deposit',
      checks: {}
    }
    
    // Check 1: Operator keypair
    try {
      const keypair = loadKeypairFromEnv()
      checks.checks.operatorKey = {
        status: 'ok',
        publicKey: keypair.publicKey.toBase58(),
      }
      console.log(`   ✅ Operator keypair: ${keypair.publicKey.toBase58()}`)
    } catch (err: any) {
      checks.checks.operatorKey = {
        status: 'error',
        error: err.message
      }
      console.error(`   ❌ Operator keypair: ${err.message}`)
    }

    // Check 2: RPC Connection
    const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL || ''
    try {
      if (!rpcUrl) throw new Error('RPC_URL not configured')
      
      const connection = new Connection(rpcUrl, 'confirmed')
      const version = await connection.getVersion()
      checks.checks.rpc = {
        status: 'ok',
        solanaVersion: version['solana-core']
      }
      console.log(`   ✅ RPC: ${version['solana-core']}`)
    } catch (err: any) {
      checks.checks.rpc = {
        status: 'error',
        error: err.message
      }
      console.error(`   ❌ RPC: ${err.message}`)
    }

    // Check 3: Privacy Cash SDK
    try {
      await import('privacycash')
      checks.checks.sdk = {
        status: 'ok'
      }
      console.log(`   ✅ Privacy Cash SDK available`)
    } catch (err: any) {
      checks.checks.sdk = {
        status: 'error',
        error: err.message
      }
      console.error(`   ❌ Privacy Cash SDK: ${err.message}`)
    }

    const allOk = Object.values(checks.checks).every((check: any) => check.status === 'ok')
    
    return res.status(allOk ? 200 : 503).json({
      status: allOk ? 'healthy' : 'unhealthy',
      ...checks
    })
    
  } catch (error: any) {
    console.error(`❌ Health check failed:`, error)
    return res.status(500).json({
      status: 'error',
      error: error.message,
    })
  }
})

/**
 * DEBUG: Detailed debug endpoint
 */
router.get('/debug', async (req: Request, res: Response) => {
  try {
    console.log(`\n🔍 DEPOSIT DEBUG ENDPOINT`)
    
    const debug: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    }

    // 1. Environment Variables
    debug.checks.env = {
      OPERATOR_SECRET_KEY: process.env.OPERATOR_SECRET_KEY ? '✅ SET' : '❌ NOT SET',
      OPERATOR_PRIVATE_KEY: process.env.OPERATOR_PRIVATE_KEY ? '✅ SET' : '❌ NOT SET',
      RPC_URL: process.env.RPC_URL ? '✅ SET' : '❌ NOT SET',
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ? '✅ SET' : '❌ NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET',
    }

    // 2. Operator Keypair
    try {
      const keypair = loadKeypairFromEnv()
      debug.checks.operatorKeypair = {
        status: 'ok',
        publicKey: keypair.publicKey.toBase58(),
      }
    } catch (err: any) {
      debug.checks.operatorKeypair = {
        status: 'error',
        error: err.message,
      }
    }

    // 3. RPC Connection
    const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL
    if (rpcUrl) {
      try {
        const connection = new Connection(rpcUrl, 'confirmed')
        const version = await connection.getVersion()
        const slot = await connection.getSlot()
        
        debug.checks.rpc = {
          status: 'ok',
          solanaVersion: version['solana-core'],
          currentSlot: slot,
        }
      } catch (err: any) {
        debug.checks.rpc = {
          status: 'error',
          error: err.message,
        }
      }
    }

    // 4. Privacy Cash SDK
    try {
      const { PrivacyCash } = await import('privacycash')
      debug.checks.sdk = {
        status: 'ok',
        hasDepositMethod: true
      }
    } catch (err: any) {
      debug.checks.sdk = {
        status: 'error',
        error: err.message,
      }
    }

    // 5. Database
    try {
      await prisma.$queryRaw`SELECT 1`
      const linkCount = await prisma.paymentLink.count()
      debug.checks.database = {
        status: 'ok',
        linkCount
      }
    } catch (err: any) {
      debug.checks.database = {
        status: 'error',
        error: err.message,
      }
    }

    const errorCount = Object.values(debug.checks)
      .filter((check: any) => check.status === 'error').length
    
    debug.summary = {
      totalChecks: Object.keys(debug.checks).length,
      errors: errorCount,
      status: errorCount === 0 ? 'all_ok' : 'issues_found'
    }

    return res.status(200).json(debug)
    
  } catch (error: any) {
    console.error(`❌ Debug endpoint failed:`, error)
    return res.status(500).json({
      status: 'error',
      error: error.message,
    })
  }
})

/**
 * ✅ ENDPOINT 1: Prepare deposit (with detailed error handling)
 */
router.post('/prepare', async (req: Request<{}, {}, any>, res: Response) => {
  const requestId = Math.random().toString(36).substring(7)
  
  try {
    const { linkId, amount, publicKey, lamports } = req.body as PrepareDepositRequest

    console.log(`\n🔗 [${requestId}] PREPARE DEPOSIT`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ Validate input
    if (!linkId || !publicKey || !amount || lamports === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      new PublicKey(publicKey)
    } catch {
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ Find link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded' })
    }

    // ✅ Load operator keypair
    console.log(`   🔐 Loading operator keypair...`)
    let operatorKeypair: any
    
    try {
      operatorKeypair = loadKeypairFromEnv()
      console.log(`   ✅ Keypair loaded`)
    } catch (err: any) {
      console.error(`   ❌ Keypair error: ${err.message}`)
      return res.status(500).json({
        error: 'Operator configuration error',
        details: 'Could not load operator keypair',
        suggestion: 'Set OPERATOR_SECRET_KEY in environment variables',
      })
    }

    // ✅ Get RPC URL
    const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL || 
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

    console.log(`   🌐 RPC: ${rpcUrl.substring(0, 40)}...`)

    // ✅ Initialize Connection
    let connection: Connection
    try {
      connection = new Connection(rpcUrl, 'confirmed')
      await connection.getLatestBlockhash()
      console.log(`   ✅ RPC verified`)
    } catch (rpcErr: any) {
      console.error(`   ❌ RPC error: ${rpcErr.message}`)
      return res.status(500).json({
        error: 'RPC connection error',
        details: rpcErr.message,
      })
    }

    // ✅ Initialize SDK and generate proof
    console.log(`   🔮 Generating proof...`)
    
    let depositResult: any
    try {
      const privacyCashClient = initializePrivacyCash(operatorKeypair, rpcUrl, true)
      
      depositResult = await privacyCashClient.deposit({
        lamports,
      })
      
      if (!depositResult || (!(depositResult as any).tx && !(depositResult as any).transaction)) {
        throw new Error('SDK returned invalid response')
      }
      
      console.log(`   ✅ Proof generated`)
    } catch (depositErr: any) {
      console.error(`   ❌ Proof error: ${depositErr.message}`)
      return res.status(500).json({
        error: 'Failed to generate deposit',
        details: depositErr.message,
      })
    }

    // ✅ Prepare transaction
    console.log(`   🔧 Preparing transaction...`)
    
    try {
      const txBuffer = Buffer.from((depositResult as any).tx || (depositResult as any).transaction, 'base64')
      const transaction = Transaction.from(txBuffer)
      
      const userPubkey = new PublicKey(publicKey)
      transaction.feePayer = userPubkey
      
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      
      console.log(`   ✅ Ready for user signature`)
      
      const modifiedTxBase64 = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).toString('base64')
      
      console.log(`\n✅ [${requestId}] PREPARED`)
      
      return res.status(200).json({
        success: true,
        transaction: modifiedTxBase64,
        amount: parseFloat(amount),
      })
      
    } catch (txErr: any) {
      console.error(`   ❌ Transaction error: ${txErr.message}`)
      return res.status(500).json({
        error: 'Failed to prepare transaction',
        details: txErr.message,
      })
    }
    
  } catch (error: any) {
    console.error(`\n❌ [${requestId}] ERROR:`, error.message)
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      requestId,
    })
  }
})

/**
 * ✅ ENDPOINT 2: Submit deposit
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { 
      linkId, 
      amount, 
      lamports, 
      publicKey, 
      signedTransaction 
    } = req.body as DepositRecordRequest

    console.log(`\n🔗 SUBMIT DEPOSIT`)

    if (!linkId || !publicKey || !signedTransaction || amount === undefined || lamports === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded' })
    }

    const amountSOL = typeof amount === 'string' ? parseFloat(amount) : amount
    const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL || 
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
    
    const connection = new Connection(rpcUrl)
    
    let transactionSignature: string
    
    try {
      const txBuffer = Buffer.from(signedTransaction, 'base64')
      
      transactionSignature = await connection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      
      console.log(`   ✅ Submitted`)
      
      const confirmation = await connection.confirmTransaction(
        transactionSignature,
        'confirmed'
      )
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed on blockchain')
      }
      
      console.log(`   ✅ Confirmed`)
      
    } catch (submitErr: any) {
      console.error(`   ❌ Submit error: ${submitErr.message}`)
      return res.status(500).json({
        error: 'Failed to submit transaction',
        details: submitErr.message,
      })
    }

    try {
      await prisma.$transaction([
        prisma.paymentLink.update({
          where: { id: linkId },
          data: { depositTx: transactionSignature },
        }),
        prisma.transaction.create({
          data: {
            type: 'deposit',
            linkId,
            transactionHash: transactionSignature,
            amount: amountSOL,
            assetType: link.assetType,
            status: 'confirmed',
            fromAddress: publicKey,
          },
        }),
      ])

      console.log(`   ✅ Recorded`)
    } catch (dbErr: any) {
      console.error(`   ❌ Database error: ${dbErr.message}`)
      return res.status(500).json({
        error: 'Transaction submitted but database recording failed',
        tx: transactionSignature,
      })
    }

    console.log(`\n✅ DEPOSIT COMPLETE`)

    return res.status(200).json({
      success: true,
      tx: transactionSignature,
      transactionHash: transactionSignature,
      amount: amountSOL,
      message: 'Deposit successful',
      status: 'confirmed',
    })
    
  } catch (error: any) {
    console.error(`❌ Submit failed:`, error)
    return res.status(500).json({
      error: error.message || 'Failed to process deposit',
    })
  }
})

export default router
