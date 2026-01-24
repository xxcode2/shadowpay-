import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { Keypair } from '@solana/web3.js'

const router = Router()

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com'

// 🚨 OPERATOR = WAJIB ADA
function getOperatorKeypair(): Keypair {
  const secret = process.env.OPERATOR_SECRET_KEY
  if (!secret) throw new Error('OPERATOR_SECRET_KEY not set')
  
  const arr = secret.split(',').map(n => Number(n.trim()))
  if (arr.length !== 64 || arr.some(isNaN)) {
    throw new Error('Invalid OPERATOR_SECRET_KEY format')
  }
  return Keypair.fromSecretKey(new Uint8Array(arr))
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress, signature } = req.body

    if (!linkId || !recipientAddress || !signature) {
      return res.status(400).json({ error: 'Missing required parameters: linkId, recipientAddress, signature' })
    }

    // Find and validate link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (!link.depositTx || link.depositTx === '') {
      return res.status(400).json({ error: 'Link has no deposit - cannot claim' })
    }

    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    // Get operator keypair
    const operator = getOperatorKeypair()

    // Initialize PrivacyCash
    const pc = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      owner: operator,
    } as any)

    // Convert SOL to lamports
    const lamports = Math.round(link.amount * 1e9)

    // Execute withdrawal
    const withdraw = await pc.withdraw({
      lamports,
      recipientAddress,
    })

    const withdrawTx = withdraw.tx

    // Atomic update
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: true,
          claimedBy: recipientAddress,
          withdrawTx: withdrawTx,
        },
      }),
      prisma.transaction.create({
        data: {
          type: 'withdraw',
          linkId,
          transactionHash: withdrawTx,
          amount: link.amount,
          assetType: link.assetType,
          status: 'confirmed',
          toAddress: recipientAddress,
        },
      }),
    ])

    res.json({ success: true, withdrawTx })
  } catch (err: any) {
    console.error('❌ Claim error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
