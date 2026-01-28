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
 * DEBUG: Health check for deposit service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    console.log(`\n🏥 DEPOSIT SERVICE HEALTH CHECK`)
    
    // Check operator keypair
    let operatorKeyOk = false
    try {
      loadKeypairFromEnv()
      operatorKeyOk = true
      console.log(`   ✅ Operator keypair loaded`)
    } catch (err: any) {
      console.error(`   ❌ Operator keypair issue:`, err.message)
    }

    return res.status(200).json({
      status: 'ok',
      service: 'deposit',
      operatorKeyOk,
      rpcUrl: (process.env.RPC_URL || 'Using default').substring(0, 50) + '...',
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
 * ✅ ENDPOINT 1: Prepare deposit (generate proof, create transaction for user to sign)
 */
router.post('/prepare', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, amount, publicKey, lamports } = req.body as PrepareDepositRequest

    console.log(`\n🔗 PREPARE DEPOSIT (USER WILL PAY)`)
    console.log(`   Link: ${linkId}`)
    console.log(`   User: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ Validate input
    if (!linkId || !publicKey || !amount || lamports === undefined) {
      return res.status(400).json({ error: 'Missing required fields: linkId, publicKey, amount, lamports' })
    }

    try {
      new PublicKey(publicKey)
    } catch {
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ Find link
    console.log(`\n🔍 Looking up payment link...`)
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

    console.log(`✅ Link verified`)

    // ✅ Load operator keypair (ONLY for SDK initialization and proof generation)
    console.log(`\n🔐 Initializing Privacy Cash SDK...`)
    console.log(`   Operator keypair used for: Proof generation only`)
    console.log(`   Fee payer will be: USER (${publicKey.slice(0, 8)}...)`)
    
    let operatorKeypair: any
    try {
      operatorKeypair = loadKeypairFromEnv()
    } catch (err: any) {
      console.error('❌ Failed to load operator keypair:', err.message)
      return res.status(500).json({
        error: 'Operator configuration error',
        details: 'Could not load operator keypair. Make sure OPERATOR_PRIVATE_KEY is set.'
      })
    }

    // ✅ Initialize SDK with operator keypair and generate proof
    console.log(`🔮 Generating zero-knowledge proof...`)
    
    try {
      const rpcUrl = process.env.RPC_URL || 
        'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
      
      const connection = new Connection(rpcUrl)
      
      console.log(`   RPC URL: ${rpcUrl.substring(0, 50)}...`)
      console.log(`   Initializing Privacy Cash SDK...`)
      
      // Initialize SDK with operator keypair (needed for SDK to work)
      const privacyCashClient = initializePrivacyCash(operatorKeypair, rpcUrl, true)
      
      console.log(`   ✅ SDK initialized`)
      console.log(`   Generating deposit proof for user: ${publicKey}`)
      
      // Generate deposit - SDK creates transaction structure
      console.log(`   Calling SDK.deposit()...`)
      const depositResult = await privacyCashClient.deposit({
        lamports,
      })
      
      console.log(`   SDK returned result:`, JSON.stringify(depositResult).substring(0, 100))
      
      if (!depositResult || (!(depositResult as any).tx && !(depositResult as any).transaction)) {
        console.error(`❌ SDK did not return valid transaction:`, depositResult)
        throw new Error('SDK did not return transaction')
      }
      
      console.log(`   ✅ ZK proof generated`)
      console.log(`   ✅ Transaction structure created`)
      
      // ✅ CRITICAL: Modify transaction to use USER as fee payer
      console.log(`\n🔧 Setting USER as fee payer...`)
      
      const txBuffer = Buffer.from((depositResult as any).tx || (depositResult as any).transaction, 'base64')
      const transaction = Transaction.from(txBuffer)
      
      // Set USER's wallet as fee payer (not operator!)
      const userPubkey = new PublicKey(publicKey)
      transaction.feePayer = userPubkey
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      
      console.log(`   ✅ Fee payer set to: ${publicKey.slice(0, 8)}... (USER)`)
      console.log(`   ✅ Blockhash: ${blockhash.slice(0, 8)}...`)
      
      // Serialize back to base64
      const modifiedTxBase64 = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).toString('base64')
      
      console.log(`   ✅ Transaction ready for user signature`)
      
      console.log(`\n✅ DEPOSIT PREPARED`)
      console.log(`   User will sign and pay all fees`)
      
      return res.status(200).json({
        success: true,
        transaction: modifiedTxBase64,
        amount: parseFloat(amount),
        message: 'Transaction prepared. USER will pay all fees when signing.',
        details: {
          feePayer: publicKey,
          userPays: true,
          estimatedFee: '~0.002 SOL',
          next: 'User signs with Phantom, then submit to /deposit endpoint',
        },
      })
      
    } catch (sdkErr: any) {
      console.error('❌ SDK Error occurred')
      console.error('   Message:', sdkErr.message)
      console.error('   Stack:', sdkErr.stack)
      console.error('   Full error:', JSON.stringify(sdkErr, null, 2))
      
      return res.status(500).json({
        error: 'Failed to generate Privacy Cash transaction',
        details: sdkErr.message || 'Unknown SDK error',
        type: sdkErr.constructor.name,
      })
    }
    
  } catch (error: any) {
    console.error('❌ Prepare deposit error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to prepare deposit',
    })
  }
})

/**
 * ✅ ENDPOINT 2: Submit deposit (user already signed the transaction)
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

    console.log(`\n🔗 SUBMIT SIGNED DEPOSIT`)
    console.log(`   Link: ${linkId}`)
    console.log(`   User: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ Validate input
    if (!linkId || !publicKey || !signedTransaction || amount === undefined || lamports === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
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

    const amountSOL = typeof amount === 'string' ? parseFloat(amount) : amount

    // ✅ Submit signed transaction to blockchain
    console.log(`\n📤 Submitting user-signed transaction...`)
    console.log(`   User's wallet will pay all fees`)
    
    const rpcUrl = process.env.RPC_URL || 
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
    const connection = new Connection(rpcUrl)
    
    let transactionSignature: string
    
    try {
      // Decode the signed transaction
      const txBuffer = Buffer.from(signedTransaction, 'base64')
      
      // Send to blockchain
      console.log(`   Sending transaction to blockchain...`)
      transactionSignature = await connection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      
      console.log(`   ✅ Transaction submitted: ${transactionSignature.slice(0, 20)}...`)
      console.log(`   ✅ USER paid all fees`)
      
      // Wait for confirmation
      console.log(`   Waiting for confirmation...`)
      const confirmation = await connection.confirmTransaction(
        transactionSignature,
        'confirmed'
      )
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed on blockchain')
      }
      
      console.log(`   ✅ Confirmed`)
      
    } catch (submitErr: any) {
      console.error('❌ Transaction submission failed:', submitErr.message)
      return res.status(500).json({
        error: 'Failed to submit transaction to blockchain',
        details: submitErr.message,
      })
    }

    // ✅ Record in database
    console.log(`\n💾 Recording in database...`)
    
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

      console.log(`   ✅ Recorded in database`)
    } catch (dbErr: any) {
      console.error('❌ Database error:', dbErr.message)
      // Transaction is on blockchain even if DB fails
      return res.status(500).json({
        error: 'Transaction submitted but database recording failed',
        tx: transactionSignature,
        details: dbErr.message,
      })
    }

    console.log(`\n✅ DEPOSIT COMPLETE`)
    console.log(`   Amount: ${amountSOL} SOL`)
    console.log(`   User wallet paid all fees`)
    console.log(`   Transaction: ${transactionSignature}`)

    return res.status(200).json({
      success: true,
      tx: transactionSignature,
      transactionHash: transactionSignature,
      amount: amountSOL,
      message: 'Deposit successful. USER paid all fees.',
      status: 'confirmed',
      details: {
        userPaid: true,
        userWallet: publicKey,
        amountSOL,
        explorerUrl: `https://solscan.io/tx/${transactionSignature}`,
        description: 'Your wallet signed this transaction and paid all fees. Funds are encrypted in Privacy Cash pool.',
      },
    })
    
  } catch (error: any) {
    console.error('❌ Submit deposit failed:', error)
    return res.status(500).json({
      error: error.message || 'Failed to process deposit',
    })
  }
})

export default router
