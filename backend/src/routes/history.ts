import express, { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

const router: Router = express.Router()

// GET /api/history/:walletAddress
router.get('/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' })
    }

    // Get all DEPOSIT transactions from this wallet (sent links)
    const sentTransactions = await prisma.transaction.findMany({
      where: {
        fromAddress: walletAddress,
        type: 'deposit',
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get all WITHDRAW transactions to this wallet (received links)
    const receivedTransactions = await prisma.transaction.findMany({
      where: {
        toAddress: walletAddress,
        type: 'withdraw',
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Format sent history - check claim status from PaymentLink
    const sent = await Promise.all(
      sentTransactions.map(async (tx: any) => {
        const link = await prisma.paymentLink.findUnique({
          where: { id: tx.linkId },
        })
        return {
          linkId: tx.linkId,
          amount: tx.amount,
          createdAt: tx.createdAt.toISOString(),
          claimed: link?.claimed ?? false,
        }
      })
    )

    // Format received history
    const received = receivedTransactions.map((tx: any) => ({
      linkId: tx.linkId,
      amount: tx.amount,
      claimedAt: tx.createdAt.toISOString(),
    }))

    return res.json({
      sent,
      received,
    })
  } catch (error) {
    console.error('❌ History error:', error)
    return res.status(500).json({ error: 'Failed to load history' })
  }
})

export default router
