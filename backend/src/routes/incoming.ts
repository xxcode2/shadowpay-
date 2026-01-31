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
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 5
    const skip = (page - 1) * limit

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
    console.log(`   Page: ${page}, Limit: ${limit}`)

    // Find all transactions where this wallet is the recipient
    // and payment has been confirmed (not just pending)
    // ✅ CRITICAL: Only filter by status='confirmed', don't exclude pending markers!
    const totalCount = await prisma.transaction.count({
      where: {
        toAddress: walletAddress,
        type: 'deposit',
        status: 'confirmed',
      },
    })

    const incomingTransactions = await prisma.transaction.findMany({
      where: {
        toAddress: walletAddress,
        type: 'deposit',
        status: 'confirmed',  // ✅ This is all we need! Status tells the truth
        // ✅ REMOVED: NOT { transactionHash: { startsWith: 'pending-' } }
        // Reason: transactionHash is just a marker, status field is what matters
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    console.log(`   ✅ Query executed successfully`)
    console.log(`   Found ${incomingTransactions.length} incoming transactions`)
    
    if (incomingTransactions.length > 0) {
      incomingTransactions.forEach((tx: any, idx: number) => {
        console.log(`     [${idx + 1}] LinkID: ${tx.linkId}, Status: ${tx.status}, Amount: ${tx.amount} SOL, TxHash: ${tx.transactionHash?.substring(0, 20)}...`)
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

    // Filter out nulls
    const allPayments = payments.filter(p => p !== null)
    const availablePayments = allPayments.filter(p => !p.withdrawn)

    console.log(`   ${availablePayments.length} available for withdrawal`)

    const totalPages = Math.ceil(totalCount / limit)

    return res.status(200).json({
      payments: allPayments,
      available: availablePayments,
      total: totalCount,
      availableCount: availablePayments.length,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    })

  } catch (err: any) {
    console.error('❌ Incoming payments error:', err.message)
    return res.status(500).json({ error: err.message || 'Failed to load incoming payments' })
  }
})

export default router
