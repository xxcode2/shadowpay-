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

    console.log(`📋 Fetching history for wallet: ${walletAddress}`)

    // ⚠️ TEMPORARY: creatorAddress field not in production DB yet
    // Fallback to transaction-based lookup until migration runs
    const sentTransactions = await prisma.transaction.findMany({
      where: {
        fromAddress: walletAddress,
        type: 'deposit',
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`   Found ${sentTransactions.length} deposit transactions`)

    // Get PaymentLink details for each transaction
    const sentLinks = await Promise.all(
      sentTransactions.map(async (tx: any) => {
        const link = await prisma.paymentLink.findUnique({
          where: { id: tx.linkId },
        })
        return {
          id: link?.id,
          amount: link?.amount,
          createdAt: tx.createdAt,
          claimed: link?.claimed,
          depositTx: link?.depositTx,
          withdrawTx: link?.withdrawTx,
        }
      })
    )

    console.log(`   Found ${sentLinks.length} sent links`)

    // Format sent links - include pending (waiting) and claimed ones
    const sent = sentLinks.map((link: any) => ({
      linkId: link.id,
      amount: link.amount,
      createdAt: link.createdAt.toISOString(),
      claimed: link.claimed,
      status: link.claimed ? 'claimed' : 'waiting',
      depositTx: link.depositTx || null,
      withdrawTx: link.withdrawTx || null,
    }))

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

    console.log(`   Found ${receivedTransactions.length} withdraw transactions`)

    // Format received history
    const received = receivedTransactions.map((tx: any) => ({
      linkId: tx.linkId,
      amount: tx.amount,
      claimedAt: tx.createdAt.toISOString(),
      status: 'received',
      withdrawTx: tx.transactionHash,
    }))

    console.log(`📤 Returning history: ${sent.length} sent, ${received.length} received`)

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
