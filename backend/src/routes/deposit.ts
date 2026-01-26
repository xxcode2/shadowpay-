import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * ✅ CORRECT ARCHITECTURE SESUAI DOKUMENTASI PRIVACY CASH:
 * Frontend sudah eksekusi deposit LANGSUNG KE SMART CONTRACT
 * Backend HANYA RECORD transaction hash - TIDAK ADA EKSEKUSI!
 * PrivacyCash SDK TIDAK DIPANGGIL DI BACKEND UNTUK DEPOSIT
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx, amount, publicKey } = req.body

    // ✅ VALIDASI MINIMAL
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }
    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx (transaction hash) required' })
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'valid amount required' })
    }
    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(publicKey)
    } catch {
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ CARI LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })
    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    // ✅ RECORD TRANSAKSI DI DATABASE (TIDAK ADA EKSEKUSI!)
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: { depositTx }
      }),
      prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: depositTx,
          amount: link.amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        }
      })
    ])

    console.log(`✅ Deposit RECORDED successfully: ${depositTx}`)
    console.log(`   Amount: ${amount} SOL paid by USER directly to Privacy Cash pool`)
    console.log(`   Link: ${linkId}`)
    
    return res.status(200).json({
      success: true,
      depositTx,
      amount,
      fee: {
        depositFee: 0,
        networkFee: 0.002,
        withdrawalBaseFee: 0.006,
        withdrawalProtocolFeePercent: 0.35,
        note: 'Withdrawal fees (0.006 SOL + 0.35%) will be charged when recipient claims'
      }
    })
  } catch (err: any) {
    console.error('❌ Deposit record error:', err)
    return res.status(500).json({
      error: 'Failed to record deposit',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
})

export default router
