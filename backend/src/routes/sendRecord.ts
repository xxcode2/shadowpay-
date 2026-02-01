import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ RECORD SEND TRANSACTION
 * 
 * Called by frontend AFTER successfully submitting a direct send to the relayer
 * The frontend has already:
 * 1. Withdrawn from Privacy Cash pool
 * 2. Submitted transaction to relayer
 * 
 * This endpoint just records it in the database for history tracking
 */

router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { senderAddress, recipientAddress, amount, transactionHash, paymentId } = req.body

    console.log(`\n📝 RECORDING SEND TRANSACTION`)
    console.log(`   From: ${senderAddress}`)
    console.log(`   To: ${recipientAddress}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   TX: ${transactionHash}`)

    // ✅ Validation
    if (!senderAddress || typeof senderAddress !== 'string') {
      return res.status(400).json({ error: 'Sender address required' })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({ error: 'Recipient address required' })
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' })
    }

    if (!transactionHash || typeof transactionHash !== 'string') {
      return res.status(400).json({ error: 'Transaction hash required' })
    }

    // ✅ Validate Solana addresses
    try {
      new PublicKey(senderAddress)
      new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid Solana address' })
    }

    // ✅ Record transaction in SavingTransaction
    try {
      // Ensure Saving record exists
      const saving = await prisma.saving.upsert({
        where: { walletAddress: senderAddress },
        update: {},
        create: { walletAddress: senderAddress }
      })

      // Record the transaction
      const lamports = Math.floor(amount * 1e9)
      await prisma.savingTransaction.create({
        data: {
          type: 'send',
          transactionHash,
          amount: BigInt(lamports),
          assetType: 'SOL',
          status: 'confirmed',
          fromAddress: senderAddress,
          toAddress: recipientAddress,
          savingId: saving.id
        }
      })
      
      console.log(`✅ Transaction recorded successfully`)
    } catch (recordErr: any) {
      console.warn('⚠️ Failed to record transaction:', recordErr.message)
      return res.status(500).json({
        error: 'Failed to record transaction',
        details: recordErr.message
      })
    }

    // ✅ Success response
    return res.status(200).json({
      success: true,
      message: '✅ Transaction recorded',
      transactionHash
    })

  } catch (err: any) {
    console.error('❌ RECORD ERROR:', err.message)
    return res.status(500).json({
      error: err.message || 'Failed to record transaction',
    })
  }
})

export default router
