import { Router, Request, Response } from 'express'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * RECORD-ONLY endpoint
 * 
 * Frontend executes REAL PrivacyCash.deposit() with USER wallet (Phantom)
 * Backend ONLY records the transaction hash (no PrivacyCash execution here)
 *
 * Flow:
 * 1. Frontend user initiates REAL deposit via PrivacyCash SDK + Phantom
 * 2. Frontend receives depositTx hash from PrivacyCash
 * 3. Frontend sends linkId + depositTx to backend
 * 4. Backend verifies tx exists on-chain (optional)
 * 5. Backend stores tx hash in database
 * 6. Link is ready for claiming
 *
 * CRITICAL: NO PrivacyCash execution here, NO operator wallet involved
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx required' })
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

    // ✅ Record deposit (store tx hash only)
    console.log(`📝 Recording REAL deposit tx ${depositTx} for link ${linkId}`)

    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        depositTx,
      },
    })

    // ✅ Create transaction record
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId,
        transactionHash: depositTx,
        lamports: link.lamports,
        assetType: link.assetType,
        status: 'confirmed',
      },
    })

    console.log(`✅ Deposit recorded: ${depositTx}`)

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
