import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from './lib/prisma'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
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

    // ---- Validation ----
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Invalid amount' })
      return
    }

    if (!['SOL', 'USDC', 'USDT'].includes(assetType)) {
      res
        .status(400)
        .json({ error: 'Invalid asset type. Must be SOL, USDC, or USDT' })
      return
    }

    if (!depositTx || typeof depositTx !== 'string') {
      res.status(400).json({ error: 'Deposit transaction hash required' })
      return
    }

    // ---- Create payment link ----
    const link = await prisma.paymentLink.create({
      data: {
        amount: Number(amount),
        assetType,
        depositTx,
      },
    })

    // ---- Record transaction ----
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId: link.id,
        transactionHash: depositTx,
        amount: Number(amount),
        assetType,
        status: 'confirmed',
      },
    })

    // ---- Response ----
    res.status(200).json({
      success: true,
      linkId: link.id,
      depositTx,
      url: `https://shadowpayy.vercel.app/claim/${link.id}`,
    })
  } catch (error) {
    console.error('Deposit error:', error)

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    })
  }
}
