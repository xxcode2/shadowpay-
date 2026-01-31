import { Router, Request, Response } from 'express'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'

const router = Router()

/**
 * POST /api/create-link
 *
 * ✅ CORRECT FLOW: Creates a payment link metadata record only
 * User deposits their own SOL - operator doesn't pay!
 *
 * Expected flow:
 * 1. USER creates link (frontend calls this endpoint with amount)
 * 2. Backend generates linkId and metadata
 * 3. USER deposits their own SOL directly to Privacy Cash pool (fee: amount + ~0.002 SOL)
 * 4. Frontend records the depositTx
 * 5. Recipient can now claim - Backend will execute withdrawal
 *
 * ECONOMIC MODEL:
 * - User pays: The deposit amount (e.g., 0.017 SOL) + deposit network fee
 * - Operator pays: Withdrawal fees only (~0.013 SOL)
 * - Recipient receives: Amount - withdrawal fees
 *
 * This is sustainable because operator only needs to maintain ~0.1 SOL buffer
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { amount, assetType, creatorAddress } = req.body

    // ✅ Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const validAssets = ['SOL', 'USDC', 'USDT']
    if (!validAssets.includes(assetType)) {
      return res.status(400).json({ error: `Asset must be one of: ${validAssets.join(', ')}` })
    }

    // ✅ Validate creator address if provided
    if (creatorAddress && typeof creatorAddress !== 'string') {
      return res.status(400).json({ error: 'Invalid creatorAddress' })
    }

    // ✅ Generate secure linkId
    const linkId = crypto.randomBytes(16).toString('hex')
    console.log('📝 Creating payment link:', { linkId, amount, assetType, creator: creatorAddress })

    // ✅ Calculate lamports (source of truth for on-chain amount)
    const lamports = BigInt(Math.round(amount * LAMPORTS_PER_SOL))

    // ✅ Create link record
    // depositTx will be set by the deposit endpoint when user deposits to Privacy Cash pool
    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount,
        lamports,
        assetType,
        tokenMint: null,  // ✅ For backward compatibility - SOL doesn't use tokenMint
        claimed: false,
        depositTx: '', // Will be updated when deposit to Privacy Cash happens
        // ⚠️ TEMPORARY: creatorAddress not in production DB yet - will enable after migration
        // creatorAddress: creatorAddress || null,
      } as any,
    })

    console.log(`✅ Payment link created: ${linkId} for ${amount} ${assetType}`)

    return res.status(201).json({
      success: true,
      linkId,
      amount,
      assetType,
      message: 'Link created. User should now deposit to Privacy Cash pool.',
      shareUrl: `https://shadowpay.app/claim/${linkId}`,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('❌ Create link error:', error)
    return res.status(500).json({ 
      error: 'Failed to create link',
      details: error
    })
  }
})

export default router
