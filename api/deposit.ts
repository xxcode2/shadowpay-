import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from './lib/prisma'

type AssetType = 'SOL' | 'USDC' | 'USDT'

function isAssetType(value: string): value is AssetType {
  return value === 'SOL' || value === 'USDC' || value === 'USDT'
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS
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
    const { amount, assetType, depositTx } = req.body as {
      amount?: number
      assetType?: string
      depositTx?: string
    }

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' })
      return
    }

    if (!assetType || !isAssetType(assetType)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }

    if (!depositTx) {
      res.status(400).json({ error: 'Deposit transaction hash required' })
      return
    }

    // ⬇️ assetType sekarang BENAR-BENAR AssetType
    const link = await prisma.paymentLink.create({
      data: {
        amount,
        assetType,
        depositTx,
      },
    })

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
    })
  } catch (error) {
    console.error('Deposit error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    })
  }
}
