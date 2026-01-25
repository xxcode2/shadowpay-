import { Router, Request, Response } from 'express'
import { LAMPORTS_PER_SOL, PublicKey, Connection, Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { assertOperatorBalance } from '../utils/operatorBalanceGuard.js'

const router = Router()
const RPC = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com'

function getOperator(): Keypair {
  const secretKeyStr = process.env.OPERATOR_SECRET_KEY
  if (!secretKeyStr) {
    throw new Error('OPERATOR_SECRET_KEY not set in environment variables')
  }

  try {
    let keyArray: number[]
    if (secretKeyStr.startsWith('[') && secretKeyStr.endsWith(']')) {
      keyArray = JSON.parse(secretKeyStr)
    } else {
      keyArray = secretKeyStr
        .split(',')
        .map(num => parseInt(num.trim(), 10))
        .filter(num => !isNaN(num))
    }

    if (keyArray.length !== 64) {
      throw new Error(`Invalid key length: ${keyArray.length} (expected 64)`)
    }

    const secretKey = Uint8Array.from(keyArray)
    return Keypair.fromSecretKey(secretKey)
  } catch (err) {
    console.error('❌ Failed to parse OPERATOR_SECRET_KEY:', err)
    throw new Error('Invalid OPERATOR_SECRET_KEY format. Expected 64 comma-separated numbers.')
  }
}

/**
 * POST /api/deposit
 *
 * ✅ CORRECT ARCHITECTURE:
 * Frontend sends: linkId + signature (user authorization only)
 * Backend executes: PrivacyCash deposit with OPERATOR private key
 * User never exposes private key - only authorizes via message signature
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, signature, publicKey, amount } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!signature || !Array.isArray(signature)) {
      return res.status(400).json({ error: 'signature (array) required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey required' })
    }

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount required' })
    }

    // ✅ Find link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    // ✅ VERIFY SIGNATURE (user authorization)
    if (process.env.NODE_ENV !== 'development') {
      try {
        // 🔍 Validate signature format BEFORE verification
        if (!Array.isArray(signature) || signature.length !== 64) {
          console.error('❌ Invalid signature size:', signature.length)
          return res.status(400).json({
            error: 'Signature verification failed: bad signature size',
            expectedSize: 64,
            receivedSize: signature.length,
          })
        }

        // ✅ Create the exact same message as frontend
        const message = new TextEncoder().encode(
          `Authorize payment of ${amount} SOL for link ${linkId}`
        )

        // ✅ Convert signature array to Uint8Array
        const signatureUint8 = Uint8Array.from(signature)

        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Signature verification details:')
          console.log('   Message:', message)
          console.log('   Signature length:', signatureUint8.length)
          console.log('   Public key:', publicKey)
        }

        // ✅ Verify signature using nacl
        const isValid = nacl.sign.detached.verify(
          message,
          signatureUint8,
          new PublicKey(publicKey).toBytes()
        )

        if (!isValid) {
          console.error('❌ Signature verification failed - invalid signature')
          return res.status(401).json({
            error: 'Invalid signature - message verification failed',
          })
        }
      } catch (sigErr: any) {
        console.error('❌ Signature verification error:', sigErr.message)
        return res.status(401).json({
          error: `Signature verification failed: ${sigErr.message}`,
        })
      }
    }

    // ✅ Get operator private key
    const operator = getOperator()
    const lamports = Math.round(amount * LAMPORTS_PER_SOL)
    const connection = new Connection(RPC)

    // ✅ Check balance
    try {
      await assertOperatorBalance(connection, operator.publicKey, lamports)
    } catch (balanceErr: any) {
      console.error('❌ Balance check failed:', balanceErr.message)
      return res.status(400).json({
        error: 'Operator wallet underfunded',
        details: balanceErr.message,
      })
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏦 [DEPOSIT] Executing PrivacyCash deposit for link: ${linkId}`)
        console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
        console.log(`   User: ${publicKey}`)
      }

      // ✅ EXECUTE deposit with OPERATOR private key
      const pc = new PrivacyCash({
        RPC_url: RPC,
        owner: operator, // Operator has private key - can execute
        enableDebug: process.env.NODE_ENV === 'development',
      } as any)

      const depositResult = await pc.deposit({ lamports })
      const depositTx = depositResult.tx

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [DEPOSIT] Deposit successful: ${depositTx}`)
      }

      // ✅ Record deposit in database
      await prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          depositTx,
        },
      })

      // ✅ Create transaction record for history
      await prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: depositTx,
          amount: link.amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        },
      })

      console.log(`✅ Deposit executed and recorded: ${depositTx}`)

      return res.status(200).json({
        success: true,
        linkId,
        depositTx,
        message: 'Deposit executed successfully. Link ready to claim.',
      })
    } catch (depositErr: any) {
      console.error('❌ PrivacyCash deposit error:', depositErr.message)
      return res.status(500).json({
        error: `Deposit failed: ${depositErr.message || depositErr.toString()}`,
      })
    }
  } catch (error) {
    console.error('❌ Deposit request error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to execute deposit',
    })
  }
})

export default router
