import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/claim-link
 *
 * Marks a payment link as claimed after successful withdrawal via Privacy Cash SDK.
 * Uses atomic database update to prevent double-claiming.
 *
 * Frontend flow:
 * 1. Frontend executes withdraw via Privacy Cash SDK
 * 2. Frontend calls this endpoint with linkId, withdrawTx, and recipientAddress
 * 3. Backend atomically marks link as claimed (with WHERE claimed=false)
 * 4. If multiple claims happen simultaneously, only first one succeeds
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, withdrawTx, recipientAddress } = req.body

    // ✅ Validation
    if (!linkId || !withdrawTx || !recipientAddress) {
      return res.status(400).json({
        error: 'Missing required parameters: linkId, withdrawTx, recipientAddress',
      })
    }

    if (typeof withdrawTx !== 'string' || withdrawTx.length < 10) {
      return res.status(400).json({ error: 'Invalid withdrawTx format' })
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
