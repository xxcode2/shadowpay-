import { Router, Request, Response } from 'express'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'

const router = Router()

/**
 * POST /api/create-link
 *
 * Creates a payment link metadata record.
 * Frontend will execute deposit via Privacy Cash SDK.
 *
 * Expected flow:
 * 1. Frontend calls create-link with amount/assetType
 * 2. Backend generates linkId, returns it
 * 3. Frontend executes deposit via Privacy Cash SDK
 * 4. Frontend calls deposit endpoint with depositTx
 * 5. Backend stores depositTx, link is ready to claim
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { amount, assetType, memo } = req.body

    // ✅ Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const validAssets = ['SOL', 'USDC', 'USDT']
    if (!validAssets.includes(assetType)) {
      return res.status(400).json({ error: `Asset must be one of: ${validAssets.join(', ')}` })
    }

    // ✅ Validate memo if provided
    if (memo && typeof memo !== 'string') {
      return res.status(400).json({ error: 'Memo must be a string' })
    }

    if (memo && memo.length > 100) {
      return res.status(400).json({ error: 'Memo must be 100 characters or less' })
    }

    // ✅ Generate secure linkId
    const linkId = crypto.randomBytes(16).toString('hex')
    console.log('DEBUG: About to create link:', { linkId, amount, assetType, memo })

    // ✅ Calculate lamports (source of truth for on-chain amount)
    const lamports = BigInt(Math.round(amount * LAMPORTS_PER_SOL))

    // ✅ Create link record
    // depositTx is set to empty string initially (will be updated when frontend deposits)
    // withdrawTx is omitted (can be null)
    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount,
        lamports,
        assetType,
        memo: memo || null, // ✅ Save memo or null if not provided
        claimed: false,
        depositTx: '', // Placeholder - will be updated by deposit endpoint
        // claimedBy and withdrawTx will be set later
      } as any,
    })

    console.log(`✅ Created payment link ${linkId} for ${amount} ${assetType}` + (memo ? ` with memo: "${memo}"` : ''))
    console.log('DEBUG: Link created:', link)

    return res.status(201).json({
      success: true,
      linkId,
      amount,
      assetType,
      memo: memo || null, // ✅ Send memo back to frontend
      shareUrl: `https://shadowpayy.vercel.app?link=${linkId}`,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('❌ Create link error:', error)
    return res.status(500).json({ 
      error: 'Failed to create link',
      details: error  // Always include details for debugging
    })
  }
})

export default router
