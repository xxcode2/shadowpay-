// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ v8.0: CORRECT NON-CUSTODIAL ARCHITECTURE
 * 
 * Backend ONLY:
 * 1. Validate link exists & has deposit
 * 2. Check link not already claimed
 * 3. Mark link as claimed
 * 4. Return deposit info (so frontend can use SDK to withdraw)
 * 
 * WITHDRAWAL happens in FRONTEND via Privacy Cash SDK
 * Backend NEVER touches private keys or calls relayer
 * 
 * Flow:
 * Frontend → SDK.withdraw() → Relayer → Wallet
 *     ↓
 *  Backend (metadata only)
 */

router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress } = req.body

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

    // ✅ VALIDATE SOLANA ADDRESS FORMAT
    let validPublicKey
    try {
      validPublicKey = new PublicKey(recipientAddress)
    } catch (keyErr: any) {
      return res.status(400).json({
        error: 'Invalid Solana address format',
        details: keyErr.message,
      })
    }

    // ✅ FIND LINK
    console.log(`\n🔍 Looking up link: ${linkId}`)
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
        details: 'This link does not have a completed deposit. Creator may need to wait for deposit to confirm.',
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

    // ✅ MARK LINK AS CLAIMED (ONLY THIS - NO WITHDRAWAL)
    console.log(`🔓 Marking link as claimed for ${recipientAddress}`)

    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Link marked as claimed!`)

    // ✅ RETURN DEPOSIT INFO FOR FRONTEND TO USE WITH SDK
    console.log(`\n📤 Returning deposit info for frontend withdrawal via SDK...`)
    return res.status(200).json({
      success: true,
      claimed: true,
      message: '✅ Link claimed! Frontend will now withdraw via Privacy Cash SDK.',
      linkId,
      amount: link.amount,
      depositTx: link.depositTx,
      recipientAddress,
      claimedAt: new Date().toISOString(),
      
      // ✅ FRONTEND NEEDS THIS TO CALL SDK.WITHDRAW()
      withdrawalInfo: {
        depositTx: link.depositTx,
        amount: link.amount,
        recipient: recipientAddress,
        // Frontend will use Privacy Cash SDK to execute the actual withdrawal
      },
      
      nextStep: 'Frontend calls Privacy Cash SDK withdraw with depositTx'
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
