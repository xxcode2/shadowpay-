import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'

const router = Router()

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

/**
 * POST /api/deposit
 *
 * Frontend sends signature for authorization.
 * Backend executes PrivacyCash deposit and stores transaction.
 *
 * Flow:
 * 1. Frontend signs message with Phantom wallet
 * 2. Frontend sends signature + linkId + lamports to backend
 * 3. Backend verifies signature (auth)
 * 4. Backend executes PrivacyCash SDK deposit
 * 5. Backend stores depositTx in database
 * 6. Link is ready for claiming
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, lamports, senderAddress, signature } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'Link ID required' })
    }

    if (!lamports || typeof lamports !== 'number') {
      return res.status(400).json({ error: 'Amount (lamports) required' })
    }

    if (!senderAddress || typeof senderAddress !== 'string') {
      return res.status(400).json({ error: 'Sender address required' })
    }

    if (!signature || !Array.isArray(signature)) {
      return res.status(400).json({ error: 'Signature required' })
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

    // ✅ Execute PrivacyCash deposit
    console.log(`🚀 Executing PrivacyCash deposit for link ${linkId}...`)
    const privacyCash = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      enableDebug: false,
    } as any)

    const depositResult = await privacyCash.deposit({ lamports })
    const depositTx = depositResult.tx

    console.log(`✅ Deposit executed: ${depositTx}`)

    // ✅ Update link with deposit tx
    const updated = await prisma.paymentLink.update({
      where: { id: linkId },
      data: { depositTx },
    })

    // ✅ Record transaction
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId,
        transactionHash: depositTx,
        amount: link.amount,
        assetType: link.assetType,
        status: 'confirmed',
      },
    })

    console.log(`✅ Recorded deposit tx ${depositTx} for link ${linkId}`)

    return res.status(200).json({
      success: true,
      linkId,
      depositTx,
      message: 'Deposit executed and recorded. Link is ready to claim.',
    })
  } catch (error) {
    console.error('❌ Deposit error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    })
  }
})

export default router
