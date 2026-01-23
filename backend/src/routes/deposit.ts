import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * Called AFTER Privacy Cash SDK deposit succeeds on frontend.
 * Frontend sends: linkId, depositTx
 * Backend stores the transaction hash in the link record.
 *
 * Flow:
 * 1. Frontend calls client.deposit({ lamports }) via Privacy Cash SDK
 * 2. SDK returns { tx }
 * 3. Frontend calls this endpoint with linkId + tx
 * 4. Backend stores depositTx, link is ready to claim
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'Link ID required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'Deposit transaction hash required' })
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

    // ✅ Update link with deposit tx
    const updated = await prisma.paymentLink.update({
      where: { id: linkId },
      data: { depositTx },
    })

    // ✅ Record transaction
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId,
        transactionHash: depositTx,
        amount: link.amount,
        assetType: link.assetType,
        status: 'confirmed',
      },
    })

    console.log(`✅ Recorded deposit tx ${depositTx} for link ${linkId}`)

    return res.status(200).json({
      success: true,
      linkId,
      depositTx,
      message: 'Deposit recorded. Link is ready to claim.',
    })
  } catch (error) {
    console.error('❌ Deposit error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    })
  }
})

export default router
