// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/claim-link
 *
 * ✅ SIMPLIFIED MODEL (v3.0):
 * 
 * FLOW:
 * 1. User A deposits SOL to Privacy Cash (pays deposit fee)
 * 2. User A creates link (records deposit hash in backend)
 * 3. User B claims link (backend validates, confirms claimed)
 * 4. User B withdraws from Privacy Cash to their wallet (pays withdrawal fee)
 * 
 * RESULT: Backend only records, users handle their own deposits/withdrawals!
 * NO OPERATOR BALANCE NEEDED - just small PostgreSQL storage!
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress } = req.body

    // ✅ COMPREHENSIVE VALIDATION
    if (!linkId || typeof linkId !== 'string') {
      console.error('❌ Missing or invalid linkId')
      return res.status(400).json({
        error: 'Invalid or missing linkId',
        details: 'linkId must be a non-empty string',
      })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      console.error('❌ Missing or invalid recipientAddress')
      return res.status(400).json({
        error: 'Invalid or missing recipientAddress',
        details: 'recipientAddress must be a valid Solana address',
      })
    }

    // ✅ VALIDATE SOLANA ADDRESS FORMAT
    let validPublicKey
    try {
      validPublicKey = new PublicKey(recipientAddress)
    } catch (keyErr: any) {
      console.error('❌ Invalid Solana address:', keyErr.message)
      return res.status(400).json({
        error: 'Invalid Solana address format',
        details: keyErr.message,
      })
    }

    // ✅ FIND LINK
    console.log(`🔍 Looking up link: ${linkId}`)
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      console.error(`❌ Link not found: ${linkId}`)
      return res.status(404).json({
        error: 'Link not found',
        details: `No link found with ID: ${linkId}`,
      })
    }

    console.log(`✅ Link found: ${link.amount} SOL`)

    // ✅ CHECK DEPOSIT STATUS
    if (!link.depositTx || link.depositTx.trim() === '') {
      console.error(`❌ Link ${linkId} has no deposit recorded`)
      return res.status(400).json({
        error: 'No deposit found',
        details: 'This link does not have a completed deposit. User may need to wait for deposit to confirm.',
        linkStatus: {
          amount: link.amount,
          hasDepositTx: !!link.depositTx,
        }
      })
    }

    console.log(`✅ Deposit verified: ${link.depositTx}`)

    // ✅ CHECK CLAIM STATUS
    if (link.claimed) {
      console.error(`❌ Link ${linkId} already claimed by ${link.claimedBy}`)
      return res.status(400).json({
        error: 'Link already claimed',
        details: `This link was already claimed by ${link.claimedBy || 'unknown address'}`,
      })
    }

    console.log(`🔓 Marking link as claimed for ${recipientAddress}`)

    // ✅ MARK LINK AS CLAIMED (no withdrawal, just record!)
    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Link successfully claimed!`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   Deposit TX: ${link.depositTx}`)

    // ✅ RETURN CLAIM INFO FOR RECIPIENT TO WITHDRAW
    return res.status(200).json({
      success: true,
      message: 'Link claimed successfully! Now withdraw from Privacy Cash.',
      linkId,
      amount: link.amount,
      depositTx: link.depositTx,
      recipientAddress,
      nextStep: {
        action: 'Withdraw from Privacy Cash',
        instructions: 'Use the Privacy Cash SDK to withdraw your funds from the shielded pool to your wallet',
        example: 'await client.withdraw({ lamports: amount_in_lamports, recipientAddress })',
        fees: 'Base 0.006 SOL + 0.35% of amount'
      }
    })
  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Claim failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

export default router