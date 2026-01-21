import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'

const router = Router()

interface CreateLinkRequest {
  amount: number
  assetType: 'SOL'
  senderAddress: string
  memo?: string
  expiresInHours?: number
}

/**
 * POST /api/create-link
 *
 * This endpoint:
 * - creates a payment link record
 * - DOES NOT move funds (deposit handled elsewhere)
 */
router.post('/', async (req: Request<{}, {}, CreateLinkRequest>, res: Response) => {
  try {
    const { amount, assetType, senderAddress, memo, expiresInHours } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    if (assetType !== 'SOL') {
      return res.status(400).json({ error: 'Only SOL supported' })
    }

    if (!senderAddress) {
      return res.status(400).json({ error: 'Sender required' })
    }

    // Generate linkId securely
    const linkId = crypto.randomBytes(16).toString('hex')
    // Generate unique commitment for privacy
    const commitment = crypto.randomBytes(32).toString('hex')

    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null

    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount,
        assetType,
        commitment,
        claimed: false,
        claimedBy: null,
        depositTx: 'PENDING', // will be updated after real deposit
        withdrawTx: null,
      },
    })

    return res.json({
      success: true,
      linkId,
      url: `https://shadowpayy.vercel.app/link/${linkId}`,
    })
  } catch (err) {
    console.error('Create link error:', err)
    return res.status(500).json({ error: 'Failed to create link' })
  }
})

export default router
