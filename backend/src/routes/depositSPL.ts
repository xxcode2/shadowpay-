import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { getPrivacyCashClient } from '../services/privacyCash.js'

const router = Router()

/**
 * Supported SPL tokens with their mint addresses and decimals
 */
const SUPPORTED_TOKENS: Record<string, { name: string; decimals: number }> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'USDT', decimals: 6 },
  'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS': { name: 'ZEC', decimals: 8 },
  'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp': { name: 'ORE', decimals: 11 },
  'sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH': { name: 'STORE', decimals: 11 },
}

/**
 * POST /api/deposit-spl
 * Deposit SPL token to recipient via Privacy Cash
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      senderAddress,
      recipientAddress,
      tokenMint,
      amount,
      linkId,
    } = req.body

    // Validate inputs
    if (!senderAddress || !recipientAddress || !tokenMint || !amount || !linkId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if token is supported
    if (!SUPPORTED_TOKENS[tokenMint]) {
      return res.status(400).json({ error: 'Unsupported token' })
    }

    const tokenInfo = SUPPORTED_TOKENS[tokenMint]

    console.log(`\n💰 SPL TOKEN DEPOSIT (${tokenInfo.name})`)
    console.log(`   Sender: ${senderAddress}`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   Amount: ${amount} ${tokenInfo.name}`)
    console.log(`   Link: ${linkId}`)

    // Get Privacy Cash client
    const pc = getPrivacyCashClient()

    // Convert amount to base units
    const baseUnits = Math.floor(amount * Math.pow(10, tokenInfo.decimals))

    console.log(`   Base Units: ${baseUnits}`)
    console.log(`   Depositing to Privacy Cash...`)

    // Deposit SPL token via Privacy Cash SDK
    const depositResult = await pc.depositSPL({
      mintAddress: new PublicKey(tokenMint),
      base_units: baseUnits,
    })

    console.log(`✅ Deposit successful: ${depositResult.tx}`)

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        linkId,
        fromAddress: senderAddress,
        toAddress: recipientAddress,
        type: 'deposit',
        amount: Number(amount),
        assetType: tokenInfo.name,
        transactionHash: `pending-${linkId}`,
        status: 'pending',
        // ⚠️ tokenMint and tokenName temporarily disabled (not in production DB)
      },
    })

    // Update PaymentLink
    await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        depositTx: depositResult.tx,
        assetType: tokenInfo.name,
        // ⚠️ tokenMint and tokenName temporarily disabled (not in production DB)
      },
    })

    return res.status(200).json({
      success: true,
      linkId,
      tx: depositResult.tx,
      amount,
      token: tokenInfo.name,
      message: `✅ ${tokenInfo.name} deposit successful`,
    })

  } catch (err: any) {
    console.error('❌ SPL deposit error:', err.message)
    return res.status(500).json({
      error: err.message || 'Deposit failed',
    })
  }
})

export default router
