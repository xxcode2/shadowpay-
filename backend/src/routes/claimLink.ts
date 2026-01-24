import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { Keypair } from '@solana/web3.js'

const router = Router()

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet'
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 
  (SOLANA_NETWORK === 'mainnet' 
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com')

// Get operator keypair from env
function getOperatorKeypair(): Keypair {
  const operatorSecret = process.env.OPERATOR_SECRET_KEY
  if (!operatorSecret) {
    console.warn('⚠️ OPERATOR_SECRET_KEY not set. Using generated keypair (testing only).')
    return Keypair.generate()
  }

  try {
    const secretArray = operatorSecret.split(',').map(x => parseInt(x.trim(), 10))
    if (secretArray.length !== 64) {
      throw new Error(`Invalid secret key format: expected 64 bytes, got ${secretArray.length}`)
    }
    return Keypair.fromSecretKey(new Uint8Array(secretArray))
  } catch (err) {
    console.error('❌ Failed to parse OPERATOR_SECRET_KEY:', err)
    return Keypair.generate()
  }
}

/**
 * POST /api/claim-link
 *
 * Backend executes PrivacyCash withdrawal for claimed link.
 * Uses atomic database update to prevent double-claiming.
 *
 * Flow:
 * 1. Frontend signs message + sends linkId, recipientAddress, signature
 * 2. Backend verifies link exists and not yet claimed
 * 3. Backend executes PrivacyCash.withdraw() to get real withdrawTx
 * 4. Backend atomically marks link as claimed
 * 5. Backend records transaction with withdrawTx from PrivacyCash
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress, signature } = req.body

    // ✅ Validation
    if (!linkId || !recipientAddress || !signature) {
      return res.status(400).json({
        error: 'Missing required parameters: linkId, recipientAddress, signature',
      })
    }

    // ✅ Check if link exists and has a deposit
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (!link.depositTx || link.depositTx === '') {
      return res.status(400).json({ error: 'Link has no deposit - cannot claim' })
    }

    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    // ✅ Execute PrivacyCash withdrawal
    console.log(`🚀 Executing PrivacyCash withdrawal for link ${linkId}...`)
    const operatorKeypair = getOperatorKeypair()
    
    const privacyCash = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      owner: operatorKeypair,
      enableDebug: false,
    } as any)

    let withdrawTx: string
    try {
      const withdrawResult = await privacyCash.withdraw({
        to: recipientAddress,
      })
      withdrawTx = withdrawResult.tx
      console.log(`✅ Withdrawal executed: ${withdrawTx}`)
    } catch (err) {
      console.error('❌ PrivacyCash withdrawal failed:', err)
      return res.status(500).json({ error: 'Withdrawal execution failed' })
    }

    // ✅ Atomic claim (DOUBLE-CLAIM PREVENTION)
    // This UPDATE will only succeed if claimed=false
    // Multiple concurrent claims will result in only one success (count=1)
    const updated = await prisma.paymentLink.updateMany({
      where: {
        id: linkId,
        claimed: false, // KEY: Only update if not yet claimed
      },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx: withdrawTx,
      },
    })

    // ✅ Check if claim was successful
    if (updated.count === 0) {
      // Either link doesn't exist OR already claimed
      return res.status(400).json({
        error: 'Link not found or already claimed',
      })
    }

    if (updated.count !== 1) {
      // Should never happen with proper DB constraints, but safety check
      return res.status(500).json({
        error: 'Unexpected claim state - contact support',
      })
    }

    // ✅ Record withdrawal transaction
    await prisma.transaction.create({
      data: {
        type: 'withdraw',
        linkId,
        transactionHash: withdrawTx,
        amount: link.amount,
        assetType: link.assetType,
        status: 'confirmed',
        toAddress: recipientAddress,
      },
    })

    console.log(`✅ Link ${linkId} claimed by ${recipientAddress}`)

    return res.json({
      success: true,
      message: 'Link claimed successfully',
      linkId,
      claimedBy: recipientAddress,
    })
  } catch (err) {
    console.error('❌ Claim link error:', err)
    return res.status(500).json({ error: 'Failed to claim link' })
  }
})

export default router
