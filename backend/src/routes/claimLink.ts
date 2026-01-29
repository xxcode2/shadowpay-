// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/claim-link
 *
 * ✅ CLAIM + AUTO-WITHDRAW:
 * 
 * FLOW:
 * 1. User connects wallet → provides address
 * 2. User clicks "Claim" button
 * 3. Backend validates link + marks claimed
 * 4. Backend withdraws from Privacy Cash (using operator key) → sends to user address
 * 5. Return tx hash to frontend
 * 
 * ONE CLICK - DONE! SOL in wallet!
 */

/**
 * Helper: Check operator balance in Privacy Cash
 */
async function checkOperatorBalance(): Promise<number> {
  try {
    const { PrivacyCash } = await import('privacycash')

    // Get operator private key from env
    const operatorKeyStr = process.env.OPERATOR_SECRET_KEY || ''
    if (!operatorKeyStr) {
      throw new Error('OPERATOR_SECRET_KEY not configured')
    }

    // Parse private key (support multiple formats)
    let operatorKey: number[]
    
    if (operatorKeyStr.includes(',')) {
      operatorKey = operatorKeyStr.split(',').map(n => parseInt(n.trim(), 10))
    } else if (operatorKeyStr.startsWith('[')) {
      operatorKey = JSON.parse(operatorKeyStr)
    } else {
      const buffer = Buffer.from(operatorKeyStr, 'base64')
      operatorKey = Array.from(buffer)
    }

    if (!Array.isArray(operatorKey) || operatorKey.length !== 64) {
      throw new Error(`Invalid operator key: got ${operatorKey.length} bytes, need 64`)
    }

    const client = new PrivacyCash({
      RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
      owner: operatorKey
    })

    const balance = await client.getPrivateBalance()
    const balanceSOL = balance.lamports / 1_000_000_000
    
    console.log(`💰 Operator Private Cash Balance: ${balanceSOL.toFixed(6)} SOL`)
    return balanceSOL
  } catch (err: any) {
    console.error(`❌ Failed to check balance:`, err.message)
    throw err
  }
}

/**
 * Helper: Withdraw from Privacy Cash to user address
 */
async function withdrawFromPrivacyCash(
  amount: number,
  recipientAddress: string,
  linkId: string
): Promise<{ success: boolean; tx: string; amountReceived: number; feePaid: number }> {
  try {
    console.log(`\n💰 WITHDRAWING FROM PRIVACY CASH`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   Link: ${linkId}`)

    const { PrivacyCash } = await import('privacycash')

    // Get operator private key from env
    const operatorKeyStr = process.env.OPERATOR_SECRET_KEY || ''
    if (!operatorKeyStr) {
      throw new Error('OPERATOR_SECRET_KEY not configured')
    }

    // Parse private key (support multiple formats)
    let operatorKey: number[]
    
    // Try format 1: comma-separated numbers
    if (operatorKeyStr.includes(',')) {
      operatorKey = operatorKeyStr.split(',').map(n => parseInt(n.trim(), 10))
    }
    // Try format 2: JSON array
    else if (operatorKeyStr.startsWith('[')) {
      operatorKey = JSON.parse(operatorKeyStr)
    }
    // Try format 3: base64
    else {
      const buffer = Buffer.from(operatorKeyStr, 'base64')
      operatorKey = Array.from(buffer)
    }

    if (!Array.isArray(operatorKey) || operatorKey.length !== 64) {
      throw new Error(`Invalid operator key: got ${operatorKey.length} bytes, need 64`)
    }

    console.log(`🔐 Initializing Privacy Cash with operator key...`)

    const client = new PrivacyCash({
      RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
      owner: operatorKey
    })

    const lamports = Math.floor(amount * 1_000_000_000)

    console.log(`⏳ Generating ZK proof and withdrawing...`)
    
    // ✅ IMPORTANT: recipientAddress must be PublicKey object, not string!
    const recipientPublicKey = new PublicKey(recipientAddress)
    
    const result = await client.withdraw({
      lamports,
      recipientAddress: recipientPublicKey
    })

    console.log(`✅ WITHDRAWAL SUCCESS!`)
    console.log(`   TX: ${result.tx}`)
    console.log(`   Amount: ${(result.amount_in_lamports / 1_000_000_000).toFixed(6)} SOL`)
    console.log(`   Fee: ${(result.fee_in_lamports / 1_000_000_000).toFixed(6)} SOL`)

    // Save withdrawal tx in database
    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        withdrawTx: result.tx,
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      tx: result.tx,
      amountReceived: result.amount_in_lamports / 1_000_000_000,
      feePaid: result.fee_in_lamports / 1_000_000_000
    }
  } catch (err: any) {
    console.error(`❌ Withdrawal failed:`, err.message)
    
    // Parse specific Privacy Cash errors
    const errorMsg = err.message || err.toString()
    
    if (errorMsg.includes('no balance') || errorMsg.includes('No enough balance')) {
      console.error(`\n⚠️ OPERATOR BALANCE ISSUE!`)
      try {
        const balance = await checkOperatorBalance()
        throw new Error(`Insufficient operator balance: ${balance.toFixed(6)} SOL available, need ${amount} SOL. Please top-up operator wallet.`)
      } catch (balCheckErr: any) {
        throw new Error(`Balance check error: ${balCheckErr.message}`)
      }
    } else if (errorMsg.includes('UTXO') || errorMsg.includes('unspent')) {
      throw new Error(`No valid UTXOs available in Privacy Cash pool. Deposit may not have confirmed yet. Wait 30-60 seconds and try again.`)
    } else if (errorMsg.includes('owner.toBuffer')) {
      throw new Error(`Invalid recipient address format. Please ensure recipient address is correct.`)
    } else if (errorMsg.includes('ZK proof')) {
      throw new Error(`ZK proof generation failed. Please try again.`)
    }
    
    throw err
  }
}

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

    // ✅ MARK LINK AS CLAIMED
    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Link marked as claimed!`)

    // ✅ WITHDRAW FROM PRIVACY CASH TO USER WALLET
    console.log(`\n💳 Step 2: Processing withdrawal to user wallet...`)
    
    try {
      const withdrawResult = await withdrawFromPrivacyCash(
        link.amount,
        recipientAddress,
        linkId
      )

      // SUCCESS!
      console.log(`\n✅ CLAIM & WITHDRAW COMPLETE!`)
      
      return res.status(200).json({
        success: true,
        claimed: true,
        withdrawn: true,
        message: 'Link claimed and SOL sent to your wallet!',
        linkId,
        amount: link.amount,
        recipientAddress,
        withdrawTx: withdrawResult.tx,
        amountReceived: withdrawResult.amountReceived,
        feePaid: withdrawResult.feePaid,
        receipt: {
          depositTx: link.depositTx,
          withdrawalTx: withdrawResult.tx,
          timestamp: new Date().toISOString(),
          solscan: `https://solscan.io/tx/${withdrawResult.tx}`
        }
      })
    } catch (withdrawErr: any) {
      console.error(`⚠️ Claim succeeded but withdrawal failed:`, withdrawErr.message)

      // Link is claimed but withdrawal failed - user should contact support
      return res.status(500).json({
        success: false,
        claimed: true,
        withdrawn: false,
        error: 'Withdrawal failed after claim',
        details: withdrawErr.message,
        message: 'Your link was claimed but withdrawal failed. Please contact support with Link ID: ' + linkId,
        linkId,
        amount: link.amount,
        recipientAddress,
        depositTx: link.depositTx,
        supportEmail: 'support@shadowpay.xyz'
      })
    }

  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Claim failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

export default router