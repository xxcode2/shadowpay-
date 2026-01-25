import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/claim-link (formerly /api/withdraw)
 *
 * Called AFTER Privacy Cash SDK withdraw succeeds on frontend.
 * Frontend sends: linkId, withdrawTx, recipientAddress
 * Backend marks link as claimed atomically to prevent double-claim.
 *
 * CRITICAL: Use atomic UPDATE with WHERE claimed=false to prevent race conditions.
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, withdrawTx, recipientAddress } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'Link ID required' })
    }

    if (!withdrawTx || typeof withdrawTx !== 'string') {
      return res.status(400).json({ error: 'Withdraw transaction hash required' })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({ error: 'Recipient address required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid recipient wallet address' })
    }

    // ✅ Check link exists
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (!link.depositTx || link.depositTx === '') {
      return res.status(400).json({ error: 'Link has no deposit tx recorded' })
    }

    // 🔐 ATOMIC UPDATE - Prevent double-claim
    // Only update if claimed is still false
    const updated = await prisma.paymentLink.updateMany({
      where: {
        id: linkId,
        claimed: false, // Critical: only update if not already claimed
      },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx,
      },
    })

    // ✅ Check if update succeeded (0 means link was already claimed)
    if (updated.count === 0) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    // ✅ Record withdrawal transaction
    await prisma.transaction.create({
      data: {
        type: 'withdraw',
        linkId,
        transactionHash: withdrawTx,
        lamports: link.lamports,
        assetType: link.assetType,
        toAddress: recipientAddress,
        status: 'confirmed',
      },
    })

    console.log(`✅ Link ${linkId} claimed by ${recipientAddress} | Withdraw tx: ${withdrawTx}`)

    return res.status(200).json({
      success: true,
      linkId,
      claimedBy: recipientAddress,
      withdrawTx,
      amount: link.amount,
      assetType: link.assetType,
      message: 'Link successfully claimed',
    })
  } catch (error) {
    console.error('❌ Claim link error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to claim link',
    })
  }
})

export default router

