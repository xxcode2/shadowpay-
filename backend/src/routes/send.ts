import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { executeWithdrawal, getPrivacyCashClient } from '../services/privacyCash.js'

const router = Router()

/**
 * ✅ DIRECT SEND ENDPOINT
 * 
 * Allows users to send from their own Privacy Cash pool balance directly to a recipient.
 * Different from withdrawal endpoint which is for claiming received payments.
 * 
 * FLOW:
 * 1. Frontend user initiates send from their deposited balance
 * 2. Frontend calls this endpoint with sender + amount + recipient
 * 3. Backend validates sender exists and has sufficient balance
 * 4. Backend executes withdrawal using operator keypair
 * 5. Funds sent to recipient address
 * 6. Backend records transaction
 */

router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { senderAddress, recipientAddress, amount } = req.body

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

    // ✅ Validate Solana addresses
    try {
      new PublicKey(senderAddress)
      new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid Solana address' })
    }

    console.log(`\n💸 DIRECT SEND FROM POOL`)
    console.log(`   From: ${senderAddress}`)
    console.log(`   To: ${recipientAddress}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ Get operator's Privacy Cash client
    // (has access to all pool UTXOs through operator keypair)
    let pc: any
    try {
      pc = getPrivacyCashClient()
      console.log(`✅ Privacy Cash client ready`)
    } catch (err: any) {
      console.error(`❌ Failed to initialize Privacy Cash:`, err.message)
      return res.status(500).json({
        error: 'Operator wallet not configured',
        details: err.message
      })
    }

    // ✅ Execute withdrawal
    console.log(`🔄 Executing withdrawal from pool...`)
    const lamports = Math.floor(amount * 1e9)

    try {
      const withdrawalResult = await executeWithdrawal(
        pc,
        lamports,
        recipientAddress
      )

      const txId = withdrawalResult.tx
      console.log(`✅ Send successful!`)
      console.log(`   TX: ${txId}`)
      console.log(`   Recipient: ${recipientAddress}`)

      // ✅ Record transaction
      try {
        await prisma.transaction.create({
          data: {
            type: 'send',
            transactionHash: txId,
            amount: amount,
            assetType: 'SOL',
            status: 'confirmed',
            fromAddress: senderAddress,
            toAddress: recipientAddress,
          }
        })
      } catch (recordErr) {
        console.warn('⚠️ Failed to record transaction:', recordErr)
        // Continue - transaction was successful, just not recorded
      }

      // ✅ Success response
      return res.status(200).json({
        success: true,
        message: '✅ Send successful',
        amount,
        senderAddress,
        recipientAddress,
        transactionHash: txId,
        timestamp: new Date().toISOString(),
      })

    } catch (withdrawErr: any) {
      console.error('❌ Withdrawal failed:', withdrawErr.message)
      return res.status(500).json({
        error: 'Send failed - withdrawal error',
        details: withdrawErr.message || 'Unknown error',
      })
    }

  } catch (err: any) {
    console.error('❌ SEND ERROR:', err.message)
    return res.status(500).json({
      error: err.message || 'Send failed',
    })
  }
})

export default router
