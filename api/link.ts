import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../../backend/src/lib/prisma'

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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Link ID required' })
      return
    }

    const link = await prisma.paymentLink.findUnique({
      where: { id },
    })

    if (!link) {
      res.status(404).json({ error: 'Link not found' })
      return
    }

    res.status(200).json({
      id: link.id,
      amount: link.amount,
      assetType: link.assetType,
      claimed: link.claimed,
      claimedBy: link.claimedBy || null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    })
  } catch (error) {
    console.error('Link lookup error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Link lookup failed',
    })
  }
}
