import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/link/:id
 * Retrieve payment link details (read-only)
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params

    const link = await prisma.paymentLink.findUnique({
      where: { id },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    return res.json({
      id: link.id,
      amount: link.amount,
      assetType: link.assetType,
      claimed: link.claimed,
      claimedBy: link.claimedBy || null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    })
  } catch (error) {
    console.error('❌ Link lookup error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Link lookup failed',
    })
  }
})

/**
 * GET /api/link/:id/status
 * Get detailed link status including deposit, claim status, and fee breakdown
 */
router.get('/:id/status', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params

    const link = await prisma.paymentLink.findUnique({
      where: { id },
      include: {
        transactions: true,
      },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    // Calculate fee breakdown
    const withdrawalBaseFee = 0.006
    const withdrawalProtocolFee = link.amount * 0.0035
    const totalFees = withdrawalBaseFee + withdrawalProtocolFee
    const amountReceived = Math.max(link.amount - totalFees, 0)

    return res.json({
      id: link.id,
      amount: link.amount,
      amountReceived,
      claimed: link.claimed,
      claimedBy: link.claimedBy || null,
      depositTx: link.depositTx,
      withdrawTx: link.withdrawTx || null,
      hasValidDeposit: !!link.depositTx && link.depositTx.trim() !== '',
      transactions: link.transactions.map((tx) => ({
        type: tx.type,
        hash: tx.transactionHash,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
      })),
      feeBreakdown: {
        baseFee: withdrawalBaseFee,
        protocolFee: withdrawalProtocolFee.toFixed(8),
        totalFees: totalFees.toFixed(8),
      },
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    })
  } catch (error) {
    console.error('❌ Link status error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get link status',
    })
  }
})

/**
 * GET /api/link
 * List all links (for admin/testing)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const links = await prisma.paymentLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return res.json(links)
  } catch (error) {
    console.error('❌ Links list error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list links',
    })
  }
})

export default router;
