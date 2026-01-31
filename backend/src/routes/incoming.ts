import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * GET /api/incoming/:walletAddress
 *
 * Get all incoming private payments for a wallet.
 * These are payments where the wallet is the designated recipient
 * and hasn't withdrawn yet.
 */
router.get('/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' })
    }

    // Validate Solana address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid Solana address' })
    }

    console.log(`\n📥 FETCHING INCOMING PAYMENTS`)
    console.log(`   Wallet: ${walletAddress}`)

    // Find all transactions where this wallet is the recipient
    // Include both pending and confirmed (in case UI needs to show "pending" status)
    const incomingTransactions = await prisma.transaction.findMany({
      where: {
        toAddress: walletAddress,
        type: 'deposit',
        // Don't filter by status - show both pending and confirmed
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`   ✅ Query executed successfully`)
    console.log(`   Found ${incomingTransactions.length} incoming transactions`)
    
    if (incomingTransactions.length > 0) {
      incomingTransactions.forEach((tx: any, idx: number) => {
        console.log(`     [${idx + 1}] LinkID: ${tx.linkId}, Status: ${tx.status}, Amount: ${tx.amount} SOL`)
      })
    }

    // Get payment details for each transaction
    const payments = await Promise.all(
      incomingTransactions.map(async (tx: any) => {
        const link = await prisma.paymentLink.findUnique({
          where: { id: tx.linkId },
        })

        if (!link) return null

        return {
          id: link.id,
          amount: link.amount,
          createdAt: tx.createdAt,
          depositTx: link.depositTx,
          withdrawn: link.claimed,
          withdrawTx: link.withdrawTx,
        }
      })
    )

    // Filter out nulls and withdrawn payments for the "available" view
    const availablePayments = payments.filter(p => p !== null && !p.withdrawn)
    const allPayments = payments.filter(p => p !== null)

    console.log(`   ${availablePayments.length} available for withdrawal`)

    return res.status(200).json({
      payments: allPayments,
      available: availablePayments,
      total: allPayments.length,
      availableCount: availablePayments.length,
    })

  } catch (err: any) {
    console.error('❌ Incoming payments error:', err.message)
    return res.status(500).json({ error: err.message || 'Failed to load incoming payments' })
  }
})

export default router
