import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * ✅ CORRECT ARCHITECTURE:
 * Frontend sends: depositTx (after user paid directly from wallet)
 * Backend ONLY: Records the transaction - does NOT execute anything
 * No PrivacyCash SDK here - execution already done by user on frontend
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx, amount, publicKey } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx required' })
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

    // ✅ RECORD ONLY - NO EXECUTION!
    console.log(`📝 Recording REAL deposit tx ${depositTx} for link ${linkId}`)
    console.log(`   Amount: ${amount} SOL paid by USER`)
    console.log(`   User: ${publicKey}`)

    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          depositTx,
        },
      }),
      prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: depositTx,
          amount: link.amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        },
      }),
    ])

    console.log(`✅ Deposit recorded successfully`)
    return res.status(200).json({
      success: true,
      linkId,
      depositTx,
      message: 'Deposit recorded successfully. Ready to claim.',
    })
  } catch (error) {
    console.error('❌ Deposit record error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record deposit',
    })
  }
})

export default router
