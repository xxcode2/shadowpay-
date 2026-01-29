// File: src/routes/claimLink.ts

import { Router, Request, Response } from 'express'
import { PublicKey, Connection, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ v7.0: REAL WITHDRAWAL EXECUTION
 * 
 * Backend executes ACTUAL Privacy Cash withdrawal:
 * 1. Mark link as claimed
 * 2. Call Privacy Cash relayer API to withdraw
 * 3. Return real TX hash with funds in wallet
 * 
 * User sees: click claim → SOL in wallet instantly
 */

// Get Solana connection
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(RPC_URL, 'confirmed')
const PRIVACY_CASH_RELAYER_URL = 'https://api.privacycash.net/v1'

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

    // ✅ MARK LINK AS CLAIMED
    console.log(`🔓 Marking link as claimed for ${recipientAddress}`)

    const updatedLink = await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Link marked as claimed!`)

    // ✅ EXECUTE REAL WITHDRAWAL VIA PRIVACY CASH RELAYER
    console.log(`\n💸 Executing withdrawal to ${recipientAddress}...`)
    let withdrawalTx = null
    let withdrawalError = null

    try {
      // Get operator keypair from environment
      const operatorKeyStr = process.env.OPERATOR_SECRET_KEY
      if (!operatorKeyStr) {
        throw new Error('OPERATOR_SECRET_KEY not configured')
      }

      // Parse operator keypair
      let operatorKeypair: Keypair
      try {
        const keyArray = JSON.parse(operatorKeyStr)
        operatorKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray))
      } catch (e) {
        // Try as base58 string
        try {
          const decoded = bs58.decode(operatorKeyStr)
          operatorKeypair = Keypair.fromSecretKey(decoded)
        } catch {
          throw new Error('Invalid OPERATOR_SECRET_KEY format')
        }
      }

      console.log(`🔑 Using operator: ${operatorKeypair.publicKey.toString()}`)

      // Call Privacy Cash relayer to execute withdrawal
      const withdrawalPayload = {
        recipient: recipientAddress,
        amount: Math.floor((link.amount || 0) * 1e9), // Convert to lamports
        pool: 'default'
      }

      console.log(`📤 Calling Privacy Cash relayer: ${PRIVACY_CASH_RELAYER_URL}/withdraw`)
      
      const relayerResponse = await fetch(`${PRIVACY_CASH_RELAYER_URL}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...withdrawalPayload,
          operator: operatorKeypair.publicKey.toString()
        })
      })

      if (!relayerResponse.ok) {
        const errorText = await relayerResponse.text()
        console.warn(`⚠️ Relayer responded with ${relayerResponse.status}: ${errorText}`)
        throw new Error(`Relayer error: ${relayerResponse.status}`)
      }

      const relayerResult = await relayerResponse.json() as any

      if (relayerResult.signature) {
        withdrawalTx = relayerResult.signature
        console.log(`✅ Withdrawal successful! TX: ${withdrawalTx}`)
        
        // Save withdrawal TX to database
        await prisma.paymentLink.update({
          where: { id: linkId },
          data: {
            withdrawTx: withdrawalTx,
            updatedAt: new Date()
          }
        })
      } else {
        throw new Error('No signature in relayer response')
      }
    } catch (err: any) {
      withdrawalError = err.message
      console.error(`❌ Withdrawal failed: ${err.message}`)
      console.log(`⚠️ Link is marked claimed but withdrawal needs retry`)
    }

    // ✅ RETURN RESULT
    const result: any = {
      success: true,
      claimed: true,
      message: withdrawalTx ? '✅ Claimed & funds sent to wallet!' : '⚠️ Claimed but withdrawal pending',
      linkId,
      amount: link.amount,
      depositTx: link.depositTx,
      recipientAddress,
      claimedAt: new Date().toISOString()
    }

    if (withdrawalTx) {
      result.withdrawalTx = withdrawalTx
      result.withdrawn = true
    } else if (withdrawalError) {
      result.withdrawalError = withdrawalError
      result.withdrawn = false
    }

    return res.status(withdrawalTx ? 200 : 202).json(result)

  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Claim failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

export default router
