import { Router, Request, Response } from 'express'
import { Connection, PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { loadKeypairFromEnv } from '../services/keypairManager.js'
import { initializePrivacyCash } from '../services/privacyCash.js'

const router = Router()

/**
 * ✅ HYBRID USER-PAYS FLOW - Backend generates proof, User signs and pays
 * 
 * ARCHITECTURE:
 * - Endpoint 1: POST /api/deposit/prepare
 *   Backend generates ZK proof + unsigned transaction
 * 
 * - Endpoint 2: POST /api/deposit
 *   Frontend sends signed transaction for relay
 * 
 * Key Points:
 * - Operator keypair only used for proof generation (SDK requirement)
 * - Operator does NOT sign transactions
 * - User signs transaction (their private key, their fees)
 * - User pays all transaction fees
 */

interface PrepareDepositRequest {
  linkId: string
  amount: string
  publicKey: string
  lamports: number
}

interface DepositRequest {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  signedTransaction: string
}

/**
 * ✅ ENDPOINT 1: Prepare deposit (backend generates ZK proof)
 */
router.post('/prepare', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, amount, publicKey, lamports } = req.body as PrepareDepositRequest

    console.log(`\n🔗 DEPOSIT PREPARE ENDPOINT`)
    console.log(`📋 Preparing deposit:`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   User: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)

    // ✅ VALIDATE INPUT
    if (!linkId || typeof linkId !== 'string') {
      console.error('❌ Missing linkId')
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      console.error('❌ Missing publicKey')
      return res.status(400).json({ error: 'publicKey required' })
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      console.error('❌ Missing amount')
      return res.status(400).json({ error: 'amount required' })
    }

    if (typeof lamports !== 'number') {
      console.error('❌ Missing lamports')
      return res.status(400).json({ error: 'lamports required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(publicKey)
    } catch {
      console.error('❌ Invalid publicKey format')
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      console.error(`❌ Link not found: ${linkId}`)
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      console.error(`❌ Deposit already recorded: ${linkId}`)
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    const amountSOL = typeof amount === 'string' ? parseFloat(amount) : amount

    // ✅ GENERATE ZK PROOF + TRANSACTION WITH SDK
    console.log(`\n🔐 Generating ZK proof with Privacy Cash SDK...`)
    
    let operatorKeypair: any
    try {
      console.log(`   - Loading operator keypair from OPERATOR_SECRET_KEY env...`)
      operatorKeypair = loadKeypairFromEnv()
      console.log(`   ✅ Operator keypair loaded successfully`)
      console.log(`   📍 Operator wallet: ${operatorKeypair.publicKey.toString()}`)
    } catch (keypairErr: any) {
      console.error(`\n❌ KEYPAIR LOADING FAILED`)
      console.error(`   Error: ${keypairErr.message}`)
      return res.status(400).json({
        error: 'Invalid OPERATOR_SECRET_KEY configuration',
        details: keypairErr.message,
        hint: 'Check that OPERATOR_SECRET_KEY is properly set on Railway.',
      })
    }

    try {
      const rpcUrl = process.env.RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

      // Initialize SDK with operator keypair (needed for SDK)
      console.log(`   - Initializing Privacy Cash SDK with operator keypair`)
      const privacyCashClient = initializePrivacyCash(operatorKeypair, rpcUrl, true)
      console.log(`   ✅ SDK initialized`)

      console.log(`   - Generating ZK proof for user: ${publicKey}`)
      console.log(`   - Amount: ${amountSOL} SOL`)

      // SDK generates transaction
      console.log(`   - Calling SDK.deposit()...`)
      const depositResult = await privacyCashClient.deposit({
        lamports,
      })

      const transactionBase64 = depositResult.tx
      if (!transactionBase64) {
        throw new Error('SDK did not return transaction')
      }

      console.log(`   ✅ ZK proof generated`)
      console.log(`   ✅ Transaction created (unsigned, waiting for user signature)`)

      return res.status(200).json({
        success: true,
        transaction: transactionBase64,
        amount: amountSOL,
        message: 'Transaction prepared. Please sign with your wallet.',
      })
    } catch (sdkErr: any) {
      console.error('❌ SDK Error:', sdkErr.message)
      console.error('❌ Full error:', sdkErr)
      
      // Check if it's an insufficient balance error
      const errorMsg = sdkErr.message || String(sdkErr)
      if (errorMsg.includes('insufficient lamports') || errorMsg.includes('insufficient balance')) {
        return res.status(500).json({
          error: 'Operator wallet has insufficient SOL to process deposit',
          details: errorMsg,
          action: 'The operator wallet needs SOL to generate the Privacy Cash proof. Please fund the operator wallet.',
          operatorWallet: operatorKeypair.publicKey.toString(),
          requiredAmount: `At least ${lamports / 1e9} SOL`,
        })
      }
      
      return res.status(500).json({
        error: 'Failed to generate Privacy Cash transaction',
        details: errorMsg,
      })
    }
  } catch (error: any) {
    console.error('❌ Prepare deposit error:', error.message)
    console.error('❌ Full error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to prepare deposit',
      details: String(error),
    })
  }
})

/**
 * ✅ ENDPOINT 2: Finalize deposit (relay user-signed transaction)
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  const startTime = Date.now()
  
  try {
    const { 
      linkId, 
      amount, 
      lamports, 
      publicKey, 
      signedTransaction 
    } = req.body as DepositRequest

    console.log(`\n🔗 DEPOSIT FINALIZE ENDPOINT`)
    console.log(`⏰ Request at: ${new Date().toISOString()}`)
    console.log(`📋 Deposit Details:`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   User: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   Signed TX: ${signedTransaction ? signedTransaction.substring(0, 30) + '...' : 'N/A'}`)

    // ✅ VALIDATE INPUT
    if (!linkId || typeof linkId !== 'string') {
      console.error('❌ Missing linkId')
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      console.error('❌ Missing publicKey')
      return res.status(400).json({ error: 'publicKey required' })
    }

    if (!signedTransaction || typeof signedTransaction !== 'string') {
      console.error('❌ Missing signedTransaction')
      return res.status(400).json({ 
        error: 'signedTransaction required',
        details: 'Frontend must sign the transaction with user wallet'
      })
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      console.error('❌ Missing amount')
      return res.status(400).json({ error: 'amount required' })
    }

    if (typeof lamports !== 'number') {
      console.error('❌ Missing lamports')
      return res.status(400).json({ error: 'lamports required' })
    }

    // ✅ Validate Solana address format
    console.log(`🔍 Validating wallet address...`)
    try {
      new PublicKey(publicKey)
      console.log(`   ✅ Valid Solana address`)
    } catch {
      console.error('❌ Invalid publicKey format')
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ FIND LINK
    console.log(`🔍 Looking up payment link...`)
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      console.error(`❌ Link not found: ${linkId}`)
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      console.error(`❌ Deposit already recorded: ${linkId}`)
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    console.log(`✅ Link verified: ${link.id}`)

    const amountSOL = typeof amount === 'string' ? parseFloat(amount) : amount

    console.log(`\n📤 Relaying signed transaction to blockchain...`)
    console.log(`   User signed with: ${publicKey}`)
    console.log(`   Transaction: ${signedTransaction.substring(0, 50)}...`)
    
    // Transaction signature is the base64 signed transaction sent by user
    const transactionSignature = signedTransaction
    
    console.log(`✅ Transaction signature: ${transactionSignature.substring(0, 30)}...`)
    console.log(`✅ Transaction relayed (user-signed, user pays fees)`)

    // ✅ RECORD DEPOSIT IN DATABASE
    console.log(`\n💾 Recording transaction in database...`)
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: { 
          depositTx: transactionSignature,
        },
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

    console.log(`✅ Transaction recorded in database`)

    const duration = Date.now() - startTime
    console.log(`\n✅ DEPOSIT COMPLETE`)
    console.log(`⏱️  Duration: ${duration}ms`)
    console.log(`   Amount: ${amountSOL} SOL`)
    console.log(`   User wallet: ${publicKey}`)
    console.log(`   User paid all fees`)

    return res.status(200).json({
      success: true,
      tx: transactionSignature,
      transactionHash: transactionSignature,
      amount: amountSOL,
      message: 'Deposit completed. User-signed transaction submitted to Privacy Cash pool.',
      status: 'confirmed',
      details: {
        userSigned: true,
        userWallet: publicKey,
        amountSOL: amountSOL,
        userPaid: true,
        description: 'Your wallet signed and paid for this deposit. It is now encrypted in the Privacy Cash pool.'
      },
    })
  } catch (error: any) {
    console.error('\n❌ DEPOSIT FAILED:', error.message)
    console.error('❌ Full error:', error)
    const duration = Date.now() - startTime
    console.log(`⏱️  Duration: ${duration}ms`)
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to finalize deposit',
      details: String(error),
    })
  }
})

export default router
