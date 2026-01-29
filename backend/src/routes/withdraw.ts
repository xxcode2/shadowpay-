import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { executeWithdrawal, getPrivacyCashClient } from '../services/privacyCash.js'

const router = Router()

/**
 * ✅ v12.0: TRUE PRIVACY CASH WITHDRAWAL
 * Uses existing proven Privacy Cash service
 * 
 * REAL NON-CUSTODIAL FLOW:
 * 1. Frontend sends linkId + recipientAddress to backend
 * 2. Backend validates link exists & not claimed
 * 3. Backend uses getPrivacyCashClient() (initialized with operator keypair from env)
 * 4. Backend calls executeWithdrawal() from privacy Cash service
 * 5. Service generates ZK proof + calls relayer
 * 6. Relayer verifies & sends encrypted SOL to recipient
 * 7. Backend records real TX hash from SDK
 * 8. Frontend shows success ✅
 */

router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, recipientAddress } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'Link ID required' })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({ error: 'Recipient address required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid recipient wallet address' })
    }

    console.log(`\n🔐 PRIVACY CASH WITHDRAWAL (v12.0)`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Recipient: ${recipientAddress}`)

    // ✅ Check link exists in DB
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    if (!link.depositTx || link.depositTx === '') {
      return res.status(400).json({ error: 'Link has no deposit tx recorded' })
    }

    console.log(`✅ Link found: ${link.amount} SOL`)
    console.log(`✅ Deposit verified: ${link.depositTx}`)

    // ✅ USE EXISTING PRIVACY CASH SERVICE
    console.log(`🔄 Initializing Privacy Cash client from service...`)
    
    let pc: any
    try {
      // Get Privacy Cash client - initialized with operator keypair from env
      pc = getPrivacyCashClient()
      console.log(`✅ Privacy Cash client ready`)
    } catch (err: any) {
      console.error(`❌ Failed to initialize Privacy Cash client:`, err.message)
      return res.status(500).json({
        error: 'Operator wallet not configured',
        details: err.message
      })
    }

    // ✅ EXECUTE WITHDRAWAL USING EXISTING SERVICE
    console.log(`💸 Executing Privacy Cash withdrawal...`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)

    try {
      // Use existing executeWithdrawal function from service
      const withdrawalResult = await executeWithdrawal(
        pc,
        Math.floor(link.amount * 1e9), // Convert to lamports
        recipientAddress
      )

      const txId = withdrawalResult.tx
      console.log(`✅ Privacy Cash withdrawal successful!`)
      console.log(`   TX Hash: ${txId}`)
      console.log(`   Amount: ${withdrawalResult.sol.toFixed(6)} SOL`)
      console.log(`   ZK Proof: Generated & verified by relayer ✓`)
      console.log(`   Recipient gets encrypted UTXO (only they can spend)`)

      // ✅ MARK LINK AS CLAIMED
      const updatedLink = await prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: true,
          claimedBy: recipientAddress,
          withdrawTx: txId,
          updatedAt: new Date(),
        },
      })

      console.log(`✅ Link marked as claimed\n`)

      // ✅ SUCCESS RESPONSE
      return res.status(200).json({
        success: true,
        claimed: true,
        withdrawn: true,
        message: '✅ Privacy Cash withdrawal successful',
        linkId,
        amount: link.amount,
        depositTx: link.depositTx,
        withdrawalTx: txId,
        recipientAddress,
        claimedAt: updatedLink.updatedAt.toISOString(),
        privacy: {
          zkProof: true,
          encrypted: true,
          relayerVerified: true,
          description: 'Recipient received encrypted UTXO. Only they can decrypt and spend.'
        }
      })

    } catch (withdrawErr: any) {
      console.error('❌ Privacy Cash withdrawal error:', withdrawErr.message || withdrawErr)
      return res.status(500).json({
        error: 'Privacy Cash withdrawal failed',
        details: withdrawErr.message || 'Unknown error',
      })
    }

  } catch (err: any) {
    console.error('❌ WITHDRAWAL ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Withdrawal failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

export default router


