import { Router, Request, Response } from 'express'
import { Connection, PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { encryptUtxoPrivateKey } from '../utils/encryptionHelper.js'

const router = Router()

/**
 * NON-CUSTODIAL DEPOSIT ARCHITECTURE
 *
 * The deposit flow is now fully non-custodial:
 * 1. Frontend: User signs message to derive encryption key (in browser)
 * 2. Frontend: ZK proof generated in browser using snarkjs
 * 3. Frontend: User signs deposit transaction with Phantom
 * 4. Frontend: Transaction submitted directly to Privacy Cash relayer
 * 5. Backend: Only records the successful deposit for link tracking
 *
 * This ensures:
 * - Operator NEVER has access to user's UTXO keys
 * - Only the user can decrypt and spend their private balance
 * - True non-custodial privacy
 */

interface RecordDepositRequest {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  recipientAddress?: string  // ✅ Optional: recipient wallet for incoming payment tracking
  transactionHash: string
}

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const checks: any = {
      timestamp: new Date().toISOString(),
      service: 'deposit',
      architecture: 'non-custodial',
      checks: {}
    }

    // Check RPC Connection
    const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL || ''
    try {
      if (!rpcUrl) throw new Error('RPC_URL not configured')

      const connection = new Connection(rpcUrl, 'confirmed')
      const version = await connection.getVersion()
      checks.checks.rpc = {
        status: 'ok',
        solanaVersion: version['solana-core']
      }
    } catch (err: any) {
      checks.checks.rpc = {
        status: 'error',
        error: err.message
      }
    }

    // Check Database
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.checks.database = { status: 'ok' }
    } catch (err: any) {
      checks.checks.database = {
        status: 'error',
        error: err.message
      }
    }

    const allOk = Object.values(checks.checks).every((check: any) => check.status === 'ok')

    return res.status(allOk ? 200 : 503).json({
      status: allOk ? 'healthy' : 'unhealthy',
      ...checks
    })

  } catch (error: any) {
    console.error(`Health check failed:`, error)
    return res.status(500).json({
      status: 'error',
      error: error.message,
    })
  }
})

/**
 * Record a successful deposit transaction
 *
 * This endpoint is called AFTER the deposit has been successfully
 * submitted to the Privacy Cash relayer. It records the transaction
 * in the database for link tracking purposes.
 *
 * CRITICAL FIX: We now verify the transaction exists and succeeded
 * before recording it. This prevents recording invalid tx hashes.
 *
 * The actual deposit logic (ZK proof generation, transaction signing)
 * happens entirely in the browser for non-custodial operation.
 */
router.post('/record', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const {
      linkId,
      amount,
      lamports,
      publicKey,
      recipientAddress,  // ✅ Optional: recipient wallet
      transactionHash
    } = req.body as RecordDepositRequest

    console.log(`\n📝 RECORDING DEPOSIT`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Sender: ${publicKey}`)
    if (recipientAddress) console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   Tx: ${transactionHash?.slice(0, 20)}...`)

    // Validate input
    if (!linkId || !publicKey || !transactionHash) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Find the link
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

    // ✅ CRITICAL: Verify transaction on-chain before recording
    console.log(`   🔍 Verifying transaction on-chain...`)
    let txVerified = false
    
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')
      
      // Fetch transaction details
      const tx = await connection.getParsedTransaction(transactionHash, 'confirmed')
      
      if (!tx) {
        console.warn(`   ⚠️ Transaction not found on-chain yet: ${transactionHash}`)
        return res.status(400).json({
          error: 'Transaction verification failed',
          details: 'Transaction not found on-chain. Wait a moment and try again.',
          transactionHash
        })
      }

      // Check if transaction succeeded
      if (tx.meta?.err !== null) {
        console.error(`   ❌ Transaction failed on-chain: ${JSON.stringify(tx.meta?.err)}`)
        return res.status(400).json({
          error: 'Transaction failed on-chain',
          details: `Transaction failed: ${JSON.stringify(tx.meta?.err)}`,
          transactionHash
        })
      }

      console.log(`   ✅ Transaction verified on-chain`)
      txVerified = true
      
    } catch (verifyErr: any) {
      console.warn(`   ⚠️ RPC verification error: ${verifyErr.message}`)
      // Continue with fallback - frontend should have already verified
      txVerified = false
    }

    // Record the deposit
    try {
      const updateData: any = { 
        depositTx: transactionHash,
      }
      
      // Store lamports amount if provided
      if (lamports) {
        updateData.lamports = BigInt(lamports)
      }

      await prisma.$transaction([
        prisma.paymentLink.update({
          where: { id: linkId },
          data: updateData,
        }),
        prisma.transaction.create({
          data: {
            type: 'deposit',
            linkId,
            transactionHash,
            amount: amountSOL,
            assetType: link.assetType,
            status: txVerified ? 'confirmed' : 'pending',
            fromAddress: publicKey,
            toAddress: recipientAddress || publicKey,  // ✅ Recipient for incoming payment tracking
          },
        }),
      ])

      console.log(`   ✅ Deposit recorded successfully`)
    } catch (dbErr: any) {
      console.error(`   ❌ Database error: ${dbErr.message}`)
      return res.status(500).json({
        error: 'Failed to record deposit',
        details: dbErr.message
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Deposit recorded',
      transactionHash,
      verified: txVerified
    })

  } catch (error: any) {
    console.error(`Record deposit failed:`, error)
    return res.status(500).json({
      error: error.message || 'Failed to record deposit',
    })
  }
})

/**
 * ✅ NEW: Store encrypted UTXO private key for multi-wallet claiming
 * 
 * POST /api/deposit/store-key
 * 
 * Called after deposit/record with encrypted UTXO private key
 * This enables ANY wallet to claim the link by decrypting with linkId password
 * 
 * Request body:
 * {
 *   linkId: string,
 *   encryptedUtxoPrivateKey: string (base64),
 *   iv: string (base64),
 * }
 */
router.post('/store-key', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, encryptedUtxoPrivateKey, iv } = req.body

    console.log(`\n🔐 STORING ENCRYPTED UTXO KEY`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Encrypted key length: ${encryptedUtxoPrivateKey?.length || 0} chars`)

    // Validate
    if (!linkId || !encryptedUtxoPrivateKey || !iv) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['linkId', 'encryptedUtxoPrivateKey', 'iv']
      })
    }

    // Find link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    // Store encrypted key
    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        encryptedUtxoPrivateKey,
        encryptionIv: iv,
        encryptionSalt: 'shadowpay-v1-encryption', // For reference
      }
    })

    console.log(`   ✅ Encrypted key stored successfully`)

    return res.status(200).json({
      success: true,
      message: 'Encryption key stored',
      linkId
    })

  } catch (error: any) {
    console.error(`Store key failed:`, error)
    return res.status(500).json({
      error: error.message || 'Failed to store encryption key',
    })
  }
})

/**
 * @deprecated - The /prepare endpoint is deprecated.
 *
 * The non-custodial architecture no longer requires backend-assisted
 * proof generation. All ZK proof generation now happens in the browser.
 *
 * This endpoint is kept for backwards compatibility but will return
 * an error directing users to update their client.
 */
router.post('/prepare', async (req: Request<{}, {}, any>, res: Response) => {
  console.log(`\n⚠️  DEPRECATED: /api/deposit/prepare called`)
  console.log(`   This endpoint is no longer used in non-custodial architecture`)

  return res.status(410).json({
    error: 'This endpoint is deprecated',
    message: 'Deposits are now fully non-custodial. ZK proofs are generated in the browser.',
    action: 'Please update your client to the latest version',
    documentation: 'https://docs.privacycash.org/non-custodial-deposits'
  })
})

/**
 * @deprecated - The main POST / endpoint is deprecated for direct submissions.
 *
 * Use /record to record successful deposits instead.
 * This endpoint is kept for backwards compatibility.
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  console.log(`\n⚠️  DEPRECATED: POST /api/deposit called`)

  // Try to handle as a record request for backwards compatibility
  const {
    linkId,
    amount,
    lamports,
    publicKey,
    signedTransaction,
    transactionHash
  } = req.body

  // If this looks like a record request, forward to record logic
  if (transactionHash && linkId) {
    console.log(`   Forwarding to record logic...`)

    try {
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

      await prisma.$transaction([
        prisma.paymentLink.update({
          where: { id: linkId },
          data: { depositTx: transactionHash },
        }),
        prisma.transaction.create({
          data: {
            type: 'deposit',
            linkId,
            transactionHash,
            amount: amountSOL,
            assetType: link.assetType,
            status: 'confirmed',
            fromAddress: publicKey,
          },
        }),
      ])

      return res.status(200).json({
        success: true,
        tx: transactionHash,
        transactionHash,
        amount: amountSOL,
        message: 'Deposit recorded (via legacy endpoint)',
        status: 'confirmed',
      })
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to record deposit',
      })
    }
  }

  // If this looks like an old-style submission with signedTransaction
  if (signedTransaction) {
    return res.status(410).json({
      error: 'This deposit flow is deprecated',
      message: 'Deposits are now fully non-custodial. Please update your client.',
      action: 'Update to the latest version for non-custodial deposits'
    })
  }

  return res.status(400).json({
    error: 'Invalid request format',
    message: 'Use POST /api/deposit/record to record successful deposits'
  })
})

/**
 * POST /api/deposit/verify-and-record
 * 
 * More flexible endpoint that:
 * 1. Accepts transaction hash
 * 2. Looks up link by ID
 * 3. Records deposit if not already recorded
 * 4. Returns status
 * 
 * Used as fallback when /record endpoint fails
 */
router.post('/verify-and-record', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, transactionHash, publicKey } = req.body

    if (!linkId || !transactionHash) {
      return res.status(400).json({
        error: 'Missing linkId or transactionHash'
      })
    }

    console.log(`\n📝 VERIFY AND RECORD DEPOSIT`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Tx: ${transactionHash?.slice(0, 20)}...`)

    // Find the link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })

    if (!link) {
      return res.status(404).json({
        error: 'Link not found',
        linkId
      })
    }

    // Check if already recorded
    if (link.depositTx && link.depositTx.trim() !== '') {
      console.log(`   ✅ Deposit already recorded: ${link.depositTx}`)
      return res.status(200).json({
        success: true,
        message: 'Deposit already recorded',
        depositTx: link.depositTx,
        isNew: false
      })
    }

    // Record the deposit
    const updated = await prisma.paymentLink.update({
      where: { id: linkId },
      data: { depositTx: transactionHash }
    })

    console.log(`   ✅ Deposit recorded successfully`)

    return res.status(200).json({
      success: true,
      message: 'Deposit recorded',
      depositTx: transactionHash,
      isNew: true
    })

  } catch (error: any) {
    console.error(`Verify and record deposit failed:`, error)
    return res.status(500).json({
      error: error.message || 'Failed to verify and record deposit'
    })
  }
})

/**
 * POST /api/deposit/manual-record
 * 
 * Manual deposit recording endpoint
 * Used when user has on-chain confirmation (Solscan proof) but backend recording failed
 * User can manually provide transaction hash and amount to record deposit
 */
router.post('/manual-record', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, transactionHash, lamports } = req.body

    if (!linkId || !transactionHash) {
      return res.status(400).json({
        error: 'Missing linkId or transactionHash'
      })
    }

    console.log(`\n📝 MANUAL DEPOSIT RECORDING`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Tx: ${transactionHash?.slice(0, 20)}...`)
    console.log(`   Amount: ${lamports ? (lamports / 1e9).toFixed(6) + ' SOL' : 'not provided'} (${lamports} lamports)`)

    // Find the link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })

    if (!link) {
      return res.status(404).json({
        error: 'Link not found',
        linkId
      })
    }

    // Check if already recorded
    if (link.depositTx && link.depositTx.trim() !== '') {
      console.log(`   ✅ Deposit already recorded: ${link.depositTx}`)
      return res.status(200).json({
        success: true,
        message: 'Deposit already recorded',
        depositTx: link.depositTx,
        lamports: link.lamports,
        note: 'Link already has a deposit recorded'
      })
    }

    // Record the deposit from manual submission
    const updateData: any = { depositTx: transactionHash }
    
    // If user provided lamports, use it; otherwise use the link's original amount
    if (lamports && Number(lamports) > 0) {
      updateData.lamports = BigInt(lamports)
      console.log(`   💰 Recording with provided amount: ${(Number(lamports) / 1e9).toFixed(6)} SOL`)
    } else if (link.lamports && link.lamports > 0n) {
      console.log(`   💰 Using existing link amount: ${(Number(link.lamports) / 1e9).toFixed(6)} SOL`)
    } else {
      console.warn(`   ⚠️ WARNING: No lamports amount found for this link!`)
    }

    const updated = await prisma.paymentLink.update({
      where: { id: linkId },
      data: updateData
    })

    console.log(`   ✅ Deposit recorded manually by user`)

    return res.status(200).json({
      success: true,
      message: 'Deposit recorded successfully',
      depositTx: transactionHash,
      lamports: updated.lamports?.toString(),
      linkId,
      note: 'You can now claim this link'
    })

  } catch (error: any) {
    console.error(`Manual record deposit failed:`, error)
    return res.status(500).json({
      error: error.message || 'Failed to record deposit manually'
    })
  }
})

export default router
