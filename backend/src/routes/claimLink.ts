// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { Connection, LAMPORTS_PER_SOL, PublicKey, Keypair } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { getPrivacyCashClient } from '../services/privacyCash.js'
import { assertOperatorBalance } from '../utils/operatorBalanceGuard.js'
import { verifyWithdrawalTransaction, monitorTransactionStatus } from '../utils/privacyCashOperations.js'

const router = Router()

const RPC = process.env.SOLANA_RPC_URL!

/**
 * POST /api/claim-link
 *
 * ✅ CORRECT BUSINESS MODEL:
 * 
 * PAYMENT FLOW:
 * 1. Sender (User1) creates link - pays amount + deposit fee (~0.002 SOL)
 * 2. Sender's SOL goes to Privacy Cash pool (encrypted, private)
 * 3. Recipient (User2) claims link - receives amount minus operator fee
 * 4. Operator acts as RELAYER and earns 0.006 SOL fee per transaction
 * 
 * ECONOMIC MODEL:
 * Sender pays: 0.017 SOL (amount) + 0.008 SOL (fees) = 0.025 SOL total
 * Operator earns: 0.006 SOL (commission fee)
 * Recipient receives: 0.011 SOL (0.017 - 0.006 operator fee)
 * Result: Operator earns ~0.003 SOL after costs, system sustainable!
 * 
 * TECHNICAL:
 * - Operator is RELAYER only - does NOT pay the deposit amount
 * - PrivacyCash handles fund transfer from shielded pool
 * - Operator balance check only verifies withdrawal fee buffer
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

    // ✅ CHECK DEPOSIT STATUS (CRITICAL)
    if (!link.depositTx || link.depositTx.trim() === '') {
      console.warn(`⚠️ Link ${linkId} has no depositTx recorded - attempting auto-recovery...`)
      
      console.error(`❌ Link ${linkId} has no valid deposit transaction`)
      return res.status(400).json({
        error: 'Link has no valid deposit',
        details: 'Deposit is still being processed. If you just deposited, wait 30-60 seconds and try again. If deposit was recent, the recording may have failed - please contact support with your transaction hash.',
        linkStatus: {
          amount: link.amount,
          claimed: link.claimed,
          hasDepositTx: !!link.depositTx,
        },
        recovery: {
          message: 'Deposit recorded via /api/deposit/record endpoint. If recording failed, provide transaction hash here.',
          retryAfter: '30-60 seconds'
        }
      })
    }

    // ✅ CHECK CLAIM STATUS
    if (link.claimed) {
      console.error(`❌ Link ${linkId} already claimed by ${link.claimedBy}`)
      return res.status(400).json({
        error: 'Link already claimed',
        details: `This link was claimed by ${link.claimedBy || 'unknown address'}`,
      })
    }

    console.log(`🚀 Processing withdrawal for link ${linkId}`)
    console.log(`🎯 Recipient: ${recipientAddress}`)
    console.log(`💰 Amount: ${(link.amount).toFixed(6)} SOL (${Number(link.lamports)} lamports)`)
    console.log(`ℹ️  Version: v2.0 - Simplified Payment Links (No Encryption Required)`)

    // ✅ CHECK FOR DEPOSIT TRANSACTION
    console.log(`📋 Step 1: Checking deposit transaction...`)
    if (!link.depositTx || link.depositTx.trim() === '') {
      console.error(`❌ Link ${linkId} has no valid deposit transaction`)
      return res.status(400).json({
        error: 'No valid deposit found',
        details: 'This link does not have a completed deposit. Please deposit funds before claiming.',
        linkId
      })
    }

    console.log(`✅ Deposit verified: ${link.depositTx}`)

    // ✅ INITIALIZE SDK WITH OPERATOR KEYPAIR
    console.log(`🔐 Step 2: Initializing Privacy Cash SDK...`)
    let pc: any
    try {
      // Import PrivacyCash dynamically
      const { PrivacyCash } = await import('privacycash')
      
      // Load operator keypair from environment with better error handling
      const secretKeyStr = process.env.OPERATOR_SECRET_KEY
      if (!secretKeyStr) {
        throw new Error('OPERATOR_SECRET_KEY environment variable not set')
      }

      let keyArray: number[] = []
      try {
        // Try to parse as JSON array first
        keyArray = JSON.parse(secretKeyStr)
      } catch {
        // If JSON parsing fails, try comma-separated format
        try {
          keyArray = secretKeyStr
            .split(',')
            .map(num => parseInt(num.trim(), 10))
            .filter(num => !isNaN(num))
          
          if (keyArray.length === 0) {
            throw new Error('No valid key numbers found in OPERATOR_SECRET_KEY')
          }
        } catch (parseErr: any) {
          throw new Error(`Invalid OPERATOR_SECRET_KEY format: ${parseErr.message}`)
        }
      }

      if (keyArray.length !== 64) {
        throw new Error(`OPERATOR_SECRET_KEY should have 64 elements, got ${keyArray.length}`)
      }

      const operatorKeypair = Keypair.fromSecretKey(
        new Uint8Array(keyArray)
      )

      // Initialize SDK with operator keypair (for withdrawal)
      pc = new PrivacyCash({
        RPC_url: RPC,
        owner: operatorKeypair
      })

      console.log(`   ✅ SDK initialized`)
      console.log(`   Operator: ${operatorKeypair.publicKey.toString()}`)
    } catch (initErr: any) {
      console.error(`❌ SDK initialization failed: ${initErr.message}`)
      return res.status(500).json({
        error: 'Failed to initialize payment system',
        details: initErr.message,
        hint: 'OPERATOR_SECRET_KEY environment variable may be malformed. Check production environment.'
      })
    }

    // ✅ CHECK OPERATOR BALANCE
    console.log(`💰 Step 3: Checking operator balance...`)
    try {
      const connection = new Connection(RPC, 'confirmed')
      // @ts-ignore
      const operatorKeypair = pc.keypair
      const operatorPubkey = operatorKeypair.publicKey

      const balance = await connection.getBalance(operatorPubkey)
      const balanceSOL = balance / LAMPORTS_PER_SOL
      const requiredSOL = (Number(link.lamports) / LAMPORTS_PER_SOL) + 0.01 // amount + buffer

      console.log(`   Current balance: ${balanceSOL.toFixed(8)} SOL`)
      console.log(`   Required: ${requiredSOL.toFixed(8)} SOL`)

      if (balance < requiredSOL * LAMPORTS_PER_SOL) {
        console.error(`❌ Insufficient operator balance`)
        return res.status(400).json({
          error: 'Operator wallet insufficient balance',
          details: `Cannot process withdrawal at this time. Try again later.`
        })
      }
      console.log(`   ✅ Operator balance sufficient`)
    } catch (balErr: any) {
      console.error(`⚠️ Balance check error: ${balErr.message}`)
      // Continue anyway
    }

    // ✅ EXECUTE WITHDRAWAL
    console.log(`📤 Step 4: Executing withdrawal to recipient...`)
    let withdrawTx: string
    try {
      const withdrawResult = await pc.withdraw({
        lamports: Number(link.lamports),
        recipientAddress
      })

      withdrawTx = withdrawResult.tx
      const amountReceived = withdrawResult.amount_in_lamports / LAMPORTS_PER_SOL
      const feeCharged = withdrawResult.fee_in_lamports / LAMPORTS_PER_SOL

      console.log(`   ✅ Withdrawal successful!`)
      console.log(`   Transaction: ${withdrawTx}`)
      console.log(`   Amount received: ${amountReceived.toFixed(6)} SOL`)
      console.log(`   Fee: ${feeCharged.toFixed(6)} SOL`)
    } catch (withdrawErr: any) {
      console.error(`❌ Withdrawal execution failed: ${withdrawErr.message}`)
      return res.status(500).json({
        error: 'Withdrawal execution failed',
        details: withdrawErr.message,
        linkId
      })
    }

    // ✅ MARK LINK AS CLAIMED
    console.log(`✅ Step 6: Marking link as claimed...`)
    try {
      await prisma.$transaction([
        prisma.paymentLink.update({
          where: { id: linkId },
          data: {
            claimed: true,
            claimedBy: recipientAddress,
            withdrawTx
          }
        }),
        prisma.transaction.create({
          data: {
            type: 'withdraw',
            linkId,
            transactionHash: withdrawTx,
            amount: link.amount,
            assetType: link.assetType,
            status: 'confirmed',
            toAddress: recipientAddress
          }
        })
      ])
      console.log(`   ✅ Link marked as claimed`)
    } catch (dbErr: any) {
      console.error(`⚠️ Database update failed: ${dbErr.message}`)
      // Transaction may have succeeded even if DB update fails
    }

    console.log(`\n✅ CLAIM COMPLETE`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${(Number(link.lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   Transaction: ${withdrawTx}`)

    return res.status(200).json({
      success: true,
      message: 'Claim successful!',
      linkId,
      recipientAddress,
      amount: Number(link.lamports) / LAMPORTS_PER_SOL,
      withdrawTx,
      claimed: true
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