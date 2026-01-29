// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/claim-link
 *
 * ✅ CORRECT NON-CUSTODIAL FLOW (v5.0):
 * 
 * 1. User A: deposits SOL to Private Cash via FRONTEND SDK
 *    → saves depositTx hash to backend
 * 
 * 2. User B: claims link via backend
 *    → backend ONLY validates & marks claimed
 *    → returns withdrawal instructions
 * 
 * 3. User B: withdraws from Private Cash via FRONTEND SDK or web UI
 *    → NO backend involvement
 *    → USER has control of their keys
 * 
 * Backend = ONLY STORAGE & VALIDATION
 * No private keys, no withdrawal, no custody!
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

    // ✅ MARK LINK AS CLAIMED (ONLY THIS - NO WITHDRAWAL!)
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

    // ✅ RETURN SUCCESS + WITHDRAWAL INSTRUCTIONS
    return res.status(200).json({
      success: true,
      claimed: true,
      message: 'Link claimed! Now you need to withdraw from Private Cash pool.',
      linkId,
      amount: link.amount,
      depositTx: link.depositTx,
      recipientAddress,
      claimedAt: new Date().toISOString(),
      
      // ✅ WITHDRAWAL OPTIONS FOR FRONTEND/USER
      withdrawalOptions: {
        option1: {
          title: 'Easy: Privacy Cash Web UI',
          url: 'https://www.privacycash.net',
          steps: [
            'Visit https://www.privacycash.net',
            'Connect your wallet (Phantom/Solflare)',
            `Withdraw ${link.amount} SOL from pool`,
            'Funds arrive in 30-60 seconds'
          ],
          time: '5 minutes'
        },
        option2: {
          title: 'Advanced: Privacy Cash SDK',
          code: `
import { PrivacyCash } from 'privacycash'

const client = new PrivacyCash({
  RPC_url: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
  owner: [your_private_key_array]
})

const result = await client.withdraw({
  lamports: ${Math.floor((link.amount || 0) * 1_000_000_000)},
  recipientAddress: '${recipientAddress}'
})

console.log('Withdrawal TX:', result.tx)
          `,
          time: '10 minutes'
        }
      },

      nextSteps: {
        action: 'User withdraws from Private Cash',
        responsibility: 'User (not backend)',
        controls: 'User controls their own private keys',
        privacy: 'Zero-knowledge withdrawal - backend never sees it'
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
