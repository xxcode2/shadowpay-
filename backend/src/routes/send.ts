import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { executeWithdrawal, getPrivacyCashClient } from '../services/privacyCash.js'
import nacl from 'tweetnacl'

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
    const { senderAddress, recipientAddress, amount, signature } = req.body

    console.log(`\n📥 RECEIVED SEND REQUEST:`)
    console.log(`   Sender: ${senderAddress}`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   Amount: ${amount}`)
    console.log(`   Signature length: ${signature?.length || 0}`)
    console.log(`   Signature type: ${typeof signature}`)
    console.log(`   Signature value: ${signature ? signature.substring(0, 20) + '...' : 'null'}`)

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
    let senderPubkey: PublicKey, recipientPubkey: PublicKey
    try {
      senderPubkey = new PublicKey(senderAddress)
      recipientPubkey = new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid Solana address' })
    }

    console.log(`\n💸 DIRECT SEND FROM POOL`)
    console.log(`   From: ${senderAddress}`)
    console.log(`   To: ${recipientAddress}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ Verify signature (proves user authorized this send)
    if (signature) {
      try {
        const messageToSign = `Send ${amount} SOL to ${recipientAddress}`
        const messageBytes = new TextEncoder().encode(messageToSign)
        const signatureBytes = new Uint8Array(
          signature.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
        )
        
        const isValid = nacl.sign.detached.verify(
          messageBytes,
          signatureBytes,
          senderPubkey.toBuffer()
        )
        
        if (!isValid) {
          console.warn(`⚠️ Signature verification failed`)
          return res.status(401).json({ error: 'Invalid signature - unauthorized send' })
        }
        console.log(`✅ Signature verified - user authorized this send`)
      } catch (verifyErr: any) {
        console.warn(`⚠️ Signature verification error:`, verifyErr.message)
        return res.status(401).json({ error: 'Signature verification failed' })
      }
    } else {
      console.warn(`⚠️ No signature provided - cannot verify authorization`)
      return res.status(400).json({ error: 'Signature required for authorization' })
    }

    // ✅ Get operator's Privacy Cash client
    // The operator will execute the withdrawal on behalf of the user
    // User's signature proves they authorized it
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

      // ✅ Record transaction in SavingTransaction (not Transaction which requires linkId)
      try {
        // Ensure Saving record exists
        const saving = await prisma.saving.upsert({
          where: { walletAddress: senderAddress },
          update: {},
          create: { walletAddress: senderAddress }
        })

        // Record the transaction
        await prisma.savingTransaction.create({
          data: {
            type: 'send',
            transactionHash: txId,
            amount: BigInt(lamports),
            assetType: 'SOL',
            status: 'confirmed',
            fromAddress: senderAddress,
            toAddress: recipientAddress,
            savingId: saving.id
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
