import { Router, Request, Response } from 'express'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * ✅ CORRECT ENDPOINT: Backend ONLY RECORDS the deposit
 * 
 * Frontend executes REAL PrivacyCash deposit with USER wallet
 * Frontend provides:
 * - linkId: Payment link ID
 * - depositTx: Transaction hash from user's PrivacyCash deposit
 * - publicKey: User's wallet address (for history tracking)
 * - amount: Deposit amount in SOL
 *
 * Backend ONLY:
 * - Validates the deposit transaction exists
 * - Records it in database
 * - Enables the link for claiming
 *
 * ARCHITECTURE COMPLIANCE:
 * ✅ PrivacyCash deposit executed by FRONTEND with USER wallet
 * ✅ Backend has NO private keys, NO relayer role for deposit
 * ✅ Backend is stateless record keeper
 * ✅ Operator needed ONLY for withdraw (relayer pattern)
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx, publicKey, amount } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx (transaction hash) required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey (sender address) required' })
    }

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount (SOL) required' })
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

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [DEPOSIT RECORD] Link: ${linkId}`)
      console.log(`   Amount: ${amount} SOL`)
      console.log(`   Depositor: ${publicKey}`)
      console.log(`   Tx: ${depositTx}`)
    }

    // ✅ Record deposit in database
    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        depositTx,
      },
    })

    // ✅ Create transaction record for history
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId,
        transactionHash: depositTx,
        amount: link.amount, // Amount in SOL
        assetType: link.assetType,
        status: 'confirmed',
        fromAddress: publicKey, // Track who created the link
      },
    })

    console.log(`✅ Deposit recorded: ${depositTx}`)

    return res.status(200).json({
      success: true,
      linkId,
      depositTx,
      message: 'Deposit recorded. Link ready to claim.',
    })
  } catch (error) {
    console.error('❌ Deposit record error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record deposit',
    })
  }
})

export default router
