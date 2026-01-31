import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { getPrivacyCashClient } from '../services/privacyCash.js'

const router = Router()

/**
 * Supported SPL tokens
 */
const SUPPORTED_TOKENS: Record<string, { name: string; decimals: number }> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'USDT', decimals: 6 },
  'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS': { name: 'ZEC', decimals: 8 },
  'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp': { name: 'ORE', decimals: 11 },
  'sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH': { name: 'STORE', decimals: 11 },
}

/**
 * POST /api/withdraw-spl
 * Withdraw SPL token to recipient wallet
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress, tokenMint } = req.body

    if (!linkId || !recipientAddress || !tokenMint) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if token is supported
    if (!SUPPORTED_TOKENS[tokenMint]) {
      return res.status(400).json({ error: 'Unsupported token' })
    }

    const tokenInfo = SUPPORTED_TOKENS[tokenMint]

    console.log(`\n💳 SPL TOKEN WITHDRAWAL (${tokenInfo.name})`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Token: ${tokenInfo.name}`)
    console.log(`   Recipient: ${recipientAddress}`)

    // Find payment link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    console.log(`✅ Link found: ${link.amount} ${tokenInfo.name}`)

    // Get Privacy Cash client
    const pc = getPrivacyCashClient()

    console.log(`💳 Executing Privacy Cash SPL withdrawal...`)

    // Convert amount to base units
    const baseUnits = Math.floor(link.amount * Math.pow(10, tokenInfo.decimals))

    // Withdraw SPL token via Privacy Cash SDK
    const withdrawResult = await pc.withdrawSPL({
      mintAddress: new PublicKey(tokenMint),
      base_units: baseUnits,
      recipientAddress,
    })

    console.log(`✅ Withdrawal successful!`)
    console.log(`   TX: ${withdrawResult.tx}`)
    console.log(`   Amount: ${(withdrawResult.base_units / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals)} ${tokenInfo.name}`)
    console.log(`   Fee: ${(withdrawResult.fee_base_units / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals)} ${tokenInfo.name}`)

    // Mark link as claimed
    const updatedLink = await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx: withdrawResult.tx,
        updatedAt: new Date(),
      },
    })

    console.log(`✅ Link marked as claimed\n`)

    return res.status(200).json({
      success: true,
      claimed: true,
      withdrawn: true,
      message: `✅ ${tokenInfo.name} withdrawal successful`,
      linkId,
      amount: link.amount,
      token: tokenInfo.name,
      depositTx: link.depositTx,
      withdrawalTx: withdrawResult.tx,
      recipientAddress,
      claimedAt: updatedLink.updatedAt.toISOString(),
    })

  } catch (err: any) {
    console.error('❌ SPL withdrawal error:', err.message)
    return res.status(500).json({
      error: err.message || 'Withdrawal failed',
    })
  }
})

export default router
