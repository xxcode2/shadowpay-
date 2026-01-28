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
 * ✅ ENDPOINT 1: Prepare deposit (with AGGRESSIVE error logging for production debugging)
 */
router.post('/prepare', async (req: Request<{}, {}, any>, res: Response) => {
  const requestId = Math.random().toString(36).substring(7)
  
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🚀 [${requestId}] DEPOSIT PREPARE REQUEST START`)
  console.log(`${'='.repeat(80)}`)
  
  try {
    const { linkId, amount, publicKey, lamports } = req.body as PrepareDepositRequest

    console.log(`📋 REQUEST DATA:`)
    console.log(`   linkId: ${linkId}`)
    console.log(`   amount: ${amount} SOL`)
    console.log(`   publicKey: ${publicKey?.slice(0, 10)}...`)
    console.log(`   lamports: ${lamports}`)

    // ✅ Validate input
    if (!linkId || !publicKey || !amount || lamports === undefined) {
      console.error(`❌ VALIDATION FAILED: Missing required fields`)
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      new PublicKey(publicKey)
    } catch {
      console.error(`❌ VALIDATION FAILED: Invalid publicKey format`)
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ Find link
    console.log(`\n🔍 STEP 1: Finding payment link...`)
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      console.error(`❌ LINK NOT FOUND: ${linkId}`)
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      console.error(`❌ DEPOSIT ALREADY EXISTS for ${linkId}`)
      return res.status(400).json({ error: 'Deposit already recorded' })
    }
    console.log(`✅ Link found and valid`)

    // ✅ Load operator keypair
    console.log(`\n🔐 STEP 2: Loading operator keypair...`)
    let operatorKeypair: any
    
    try {
      operatorKeypair = loadKeypairFromEnv()
      console.log(`✅ Operator keypair loaded successfully`)
      console.log(`   Public key: ${operatorKeypair.publicKey.toBase58()}`)
      console.log(`   Secret key length: ${operatorKeypair.secretKey.length} bytes`)
    } catch (err: any) {
      console.error(`❌ KEYPAIR LOADING FAILED`)
      console.error(`   Error: ${err.message}`)
      console.error(`   Stack: ${err.stack}`)
      return res.status(500).json({
        error: 'Operator configuration error',
        details: 'Could not load operator keypair',
        suggestion: 'Set OPERATOR_SECRET_KEY in environment variables',
        env_vars_set: {
          OPERATOR_PRIVATE_KEY: !!process.env.OPERATOR_PRIVATE_KEY,
          OPERATOR_SECRET_KEY: !!process.env.OPERATOR_SECRET_KEY,
          RPC_URL: !!process.env.RPC_URL,
          SOLANA_RPC_URL: !!process.env.SOLANA_RPC_URL,
        }
      })
    }

    // ✅ Get RPC URL
    const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL || 
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

    console.log(`\n🌐 STEP 3: Testing RPC connection...`)
    console.log(`   RPC URL: ${rpcUrl.substring(0, 60)}...`)

    // ✅ Initialize Connection
    let connection: Connection
    try {
      connection = new Connection(rpcUrl, 'confirmed')
      const version = await connection.getVersion()
      console.log(`✅ RPC connection successful`)
      console.log(`   Solana version: ${version['solana-core']}`)
    } catch (rpcErr: any) {
      console.error(`❌ RPC CONNECTION FAILED`)
      console.error(`   Error: ${rpcErr.message}`)
      console.error(`   Stack: ${rpcErr.stack}`)
      return res.status(500).json({
        error: 'RPC connection error',
        details: rpcErr.message,
        rpc_url: rpcUrl.substring(0, 60) + '...',
      })
    }

    // ✅ Check operator wallet balance
    console.log(`\n💰 STEP 3.5: Checking operator wallet balance...`)
    try {
      const operatorBalance = await connection.getBalance(operatorKeypair.publicKey)
      const operatorBalanceSOL = operatorBalance / 1_000_000_000
      console.log(`   Operator balance: ${operatorBalanceSOL} SOL`)
      
      if (operatorBalance === 0) {
        console.error(`❌ OPERATOR WALLET HAS ZERO BALANCE`)
        return res.status(500).json({
          error: 'Operator wallet has insufficient balance',
          details: 'Operator needs some SOL to generate proofs',
          operator_wallet: operatorKeypair.publicKey.toBase58(),
          balance: operatorBalanceSOL,
          minimum_required: 0.01,
        })
      } else if (operatorBalanceSOL < 0.001) {
        console.warn(`⚠️  WARNING: Operator balance very low: ${operatorBalanceSOL} SOL`)
      } else {
        console.log(`✅ Operator balance sufficient`)
      }
    } catch (balErr: any) {
      console.error(`⚠️  Could not check balance: ${balErr.message}`)
      // Continue anyway, might be a temporary issue
    }

    // ✅ Try importing Privacy Cash SDK
    console.log(`\n🔮 STEP 4: Initializing Privacy Cash SDK...`)
    
    let privacyCashClient: any
    try {
      console.log(`   Attempting to import PrivacyCash...`)
      // Try importing
      const PrivacyCashModule = await import('privacycash')
      console.log(`✅ PrivacyCash module imported`)
      
      console.log(`   Creating SDK instance with:`)
      console.log(`     - Owner keypair: ${operatorKeypair.publicKey.toBase58()}`)
      console.log(`     - RPC URL: ${rpcUrl.substring(0, 50)}...`)
      console.log(`     - Debug mode: true`)
      
      privacyCashClient = initializePrivacyCash(operatorKeypair, rpcUrl, true)
      console.log(`✅ SDK instance created successfully`)
      console.log(`   SDK type: ${typeof privacyCashClient}`)
      console.log(`   SDK methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(privacyCashClient)).slice(0, 5).join(', ')}...`)
    } catch (sdkInitErr: any) {
      console.error(`❌ SDK INITIALIZATION FAILED`)
      console.error(`   Error name: ${sdkInitErr.name}`)
      console.error(`   Error message: ${sdkInitErr.message}`)
      console.error(`   Stack: ${sdkInitErr.stack}`)
      console.error(`   Full error object: ${JSON.stringify(sdkInitErr, null, 2)}`)
      
      return res.status(500).json({
        error: 'Privacy Cash SDK initialization failed',
        details: sdkInitErr.message,
        error_type: sdkInitErr.constructor.name,
        has_deposit_method: privacyCashClient && typeof privacyCashClient.deposit === 'function',
      })
    }

    // ✅ Call SDK deposit method
    console.log(`\n💰 STEP 5: Calling SDK.deposit() method...`)
    console.log(`   Deposit amount: ${lamports} lamports`)
    console.log(`   Calling: SDK.deposit({ lamports: ${lamports} })`)
    
    let depositResult: any
    try {
      depositResult = await privacyCashClient.deposit({
        lamports,
      })
      
      console.log(`✅ SDK.deposit() returned`)
      
      if (!depositResult || (!(depositResult as any).tx && !(depositResult as any).transaction)) {
        console.error(`   Response type: ${typeof depositResult}`)
        console.error(`   Response: ${JSON.stringify(depositResult).substring(0, 200)}`)
        throw new Error('SDK returned invalid transaction structure')
      }
      
      const txField = (depositResult as any).tx || (depositResult as any).transaction
      console.log(`✅ Transaction field: ${txField ? 'present' : 'MISSING'}`)
      console.log(`   Size: ${txField?.length} chars`)
      
    } catch (depositErr: any) {
      console.error(`❌ SDK.deposit() FAILED`)
      console.error(`   Message: ${depositErr.message}`)
      
      if (depositErr.message?.includes('Insufficient')) {
        return res.status(500).json({
          error: 'Operator wallet has insufficient balance',
          details: 'The operator wallet needs SOL to generate proofs',
        })
      }
      
      // For any other error, provide detailed info
      return res.status(500).json({
        error: 'Failed to generate deposit proof via SDK',
        details: depositErr.message,
        error_type: depositErr.constructor.name,
      })
    }

    // ✅ Process transaction for user signing
    console.log(`\n✍️  STEP 6: Preparing transaction for user signature...`)
    
    try {
      const txField = (depositResult as any).tx || (depositResult as any).transaction
      console.log(`   Transaction field found: ${txField ? 'tx' in depositResult ? 'tx' : 'transaction' : 'NONE'}`)
      console.log(`   Transaction size: ${txField?.length} chars`)
      
      const txBuffer = Buffer.from(txField, 'base64')
      console.log(`   Decoded buffer size: ${txBuffer.length} bytes`)
      
      const transaction = Transaction.from(txBuffer)
      console.log(`✅ Transaction deserialized successfully`)
      console.log(`   Original fee payer: ${transaction.feePayer?.toBase58() || 'NOT SET'}`)
      
      const userPubkey = new PublicKey(publicKey)
      transaction.feePayer = userPubkey
      console.log(`   New fee payer set to: ${userPubkey.toBase58()}`)
      
      const blockHashData = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockHashData.blockhash
      console.log(`✅ Blockhash updated: ${blockHashData.blockhash.substring(0, 10)}...`)
      
      const modifiedTxBase64 = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).toString('base64')
      
      console.log(`✅ Transaction serialized for user signature`)
      console.log(`   Serialized size: ${modifiedTxBase64.length} chars`)
      
      console.log(`\n${'='.repeat(80)}`)
      console.log(`✅ [${requestId}] DEPOSIT PREPARE SUCCESS`)
      console.log(`${'='.repeat(80)}`)
      
      return res.status(200).json({
        success: true,
        transaction: modifiedTxBase64,
        amount: parseFloat(amount),
      })
      
    } catch (txErr: any) {
      console.error(`❌ TRANSACTION PROCESSING FAILED`)
      console.error(`   Error: ${txErr.message}`)
      console.error(`   Stack: ${txErr.stack}`)
      
      return res.status(500).json({
        error: 'Failed to prepare transaction for user signature',
        details: txErr.message,
      })
    }
    
  } catch (error: any) {
    console.error(`\n${'='.repeat(80)}`)
    console.error(`❌ [${requestId}] UNCAUGHT ERROR IN DEPOSIT PREPARE`)
    console.error(`${'='.repeat(80)}`)
    console.error(`   Error name: ${error.name}`)
    console.error(`   Error message: ${error.message}`)
    console.error(`   Stack trace:\n${error.stack}`)
    console.error(`${'='.repeat(80)}`)
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      requestId,
      error_type: error.constructor.name,
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
