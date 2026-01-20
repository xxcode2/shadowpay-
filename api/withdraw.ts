import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PublicKey } from '@solana/web3.js'
import prisma from './lib/prisma'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // --- CORS ---
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
    const { linkId, recipientAddress, withdrawTx } = req.body as {
      linkId?: string
      recipientAddress?: string
      withdrawTx?: string
    }

    // --- Validation ---
    if (!linkId) {
      res.status(400).json({ error: 'Link ID required' })
      return
    }

    if (!recipientAddress) {
      res.status(400).json({ error: 'Recipient address required' })
      return
    }

    if (!withdrawTx) {
      res.status(400).json({ error: 'Withdraw transaction hash required' })
      return
    }

    // Validate Solana address
    try {
      new PublicKey(recipientAddress)
    } catch {
      res.status(400).json({ error: 'Invalid recipient address' })
      return
    }

    // --- Fetch link ---
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      res.status(404).json({ error: 'Link not found' })
      return
    }

    if (link.claimed) {
      res.status(400).json({ error: 'Link already claimed' })
      return
    }

    // --- Atomic transaction ---
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: true,
          claimedBy: recipientAddress,
          withdrawTx,
        },
      }),

      prisma.transaction.create({
        data: {
          type: 'withdraw',
          linkId,
          transactionHash: withdrawTx,
          amount: link.amount,
          assetType: link.assetType,
          toAddress: recipientAddress,
          status: 'confirmed',
        },
      }),
    ])

    res.status(200).json({
      success: true,
      withdrawTx,
      message: 'Withdrawal recorded successfully',
    })
  } catch (error) {
    console.error('Withdraw error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Withdrawal failed',
    })
  }
}
