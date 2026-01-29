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

    // ✅ NEW: Get all PaymentLinks created by this wallet (including pending ones with no deposit yet)
    const sentLinks = await prisma.paymentLink.findMany({
      where: {
        creatorAddress: walletAddress,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`   Found ${sentLinks.length} links created by this wallet`)

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
