import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../backend/dist/lib/prisma.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { amount, assetType, depositTx } = req.body

    // Validate input
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' })
      return
    }

    if (!['SOL', 'USDC', 'USDT'].includes(assetType)) {
      res.status(400).json({ error: 'Invalid asset type. Must be SOL, USDC, or USDT' })
      return
    }

    if (!depositTx || typeof depositTx !== 'string') {
      res.status(400).json({ error: 'Deposit transaction hash required' })
      return
    }

    // Create payment link in database
    const link = await prisma.paymentLink.create({
      data: {
        amount,
        assetType,
        depositTx,
      },
    })

    // Also create transaction record
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId: link.id,
        transactionHash: depositTx,
        amount,
        assetType,
        status: 'confirmed',
      },
    })

    res.status(200).json({
      success: true,
      linkId: link.id,
      depositTx,
      url: `https://shadowpayy.vercel.app/link/${link.id}`,
    })
  } catch (error) {
    console.error('Deposit error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    })
  }
}
