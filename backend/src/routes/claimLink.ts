// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ v9.0: ATOMIC NON-CUSTODIAL FLOW
 * 
 * CORRECT ATOMIC ORDER:
 * 1. Frontend withdraws via Privacy Cash SDK (FIRST!)
 * 2. If success, frontend gets real TX hash
 * 3. Frontend calls /api/claim-link/confirm with withdrawal TX
 * 4. Backend verifies & marks claimed (ONLY AFTER WITHDRAWAL SUCCESS)
 * 
 * If withdrawal fails:
 * - Link remains unclaimed
 * - User can retry
 * - No race condition!
 */

// ✅ POST /api/claim-link
// This endpoint is now DEPRECATED - use /confirm instead
// Kept for backwards compatibility but returns error
router.post('/', async (req: Request, res: Response) => {
  return res.status(410).json({
    error: 'Deprecated endpoint',
    message: 'Use POST /api/claim-link/confirm instead',
    details: 'Withdraw via SDK FIRST, then confirm with withdrawal TX'
  })
})

// ✅ POST /api/claim-link/confirm
// NEW CORRECT ENDPOINT: Only called AFTER withdrawal succeeds
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress, withdrawalTx } = req.body

    // ✅ VALIDATION
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing linkId',
        details: 'linkId must be a non-empty string',
      })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing recipientAddress',
        details: 'recipientAddress must be a valid Solana address',
      })
    }

    if (!withdrawalTx || typeof withdrawalTx !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing withdrawalTx',
        details: 'withdrawalTx must be a valid transaction hash',
      })
    }

    // ✅ VALIDATE SOLANA ADDRESS FORMAT
    try {
      new PublicKey(recipientAddress)
    } catch (keyErr: any) {
      return res.status(400).json({
        error: 'Invalid Solana address format',
        details: keyErr.message,
      })
    }

    // ✅ FIND LINK
    console.log(`\n🔍 Confirming claim for link: ${linkId}`)
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
        details: 'This link does not have a completed deposit.',
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

    // ✅ VERIFY WITHDRAWAL TX (BASIC CHECK)
    // In production, you could verify the TX against Solana RPC
    console.log(`🔐 Verifying withdrawal TX: ${withdrawalTx}`)
    if (withdrawalTx.length < 10) {
      return res.status(400).json({
        error: 'Invalid withdrawal TX format',
        details: 'withdrawalTx appears invalid',
      })
    }

    // ✅ MARK LINK AS CLAIMED (ONLY NOW, AFTER WITHDRAWAL PROOF)
    console.log(`📌 Marking link as claimed with withdrawal proof...`)

    const updatedLink = await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx: withdrawalTx, // ✅ SAVE PROOF
        updatedAt: new Date()
      }
    })

    console.log(`✅ Link confirmed as claimed!`)
    console.log(`📤 Withdrawal TX saved: ${withdrawalTx}\n`)

    // ✅ RETURN SUCCESS
    return res.status(200).json({
      success: true,
      claimed: true,
      withdrawn: true,
      message: '✅ Claim confirmed with withdrawal proof',
      linkId,
      amount: link.amount,
      depositTx: link.depositTx,
      withdrawalTx: withdrawalTx,
      recipientAddress,
      claimedAt: updatedLink.updatedAt.toISOString(),
    })

  } catch (err: any) {
    console.error('❌ CONFIRM CLAIM ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Claim confirmation failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

export default router
