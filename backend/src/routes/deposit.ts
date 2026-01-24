import { Router, Request, Response } from 'express'
import { Keypair } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'

const router = Router()

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com'

function getOperatorKeypair(): Keypair {
  let secret = process.env.OPERATOR_SECRET_KEY
  if (!secret) throw new Error('OPERATOR_SECRET_KEY not set')

  secret = secret.replace(/^["']|["']$/g, '')
  const arr = secret.split(',').map(n => Number(n.trim()))
  if (arr.length !== 64 || arr.some(isNaN)) {
    throw new Error('Invalid OPERATOR_SECRET_KEY')
  }

  return Keypair.fromSecretKey(new Uint8Array(arr))
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, lamports, senderAddress, signature } = req.body

    if (!linkId || !lamports || !senderAddress || !signature) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const link = await prisma.paymentLink.findUnique({ where: { id: linkId } })
    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (link.depositTx) return res.status(400).json({ error: 'Already deposited' })

    const operator = getOperatorKeypair()

    const pc = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      owner: operator,
    } as any)

    const deposit = await pc.deposit({ lamports })
    const depositTx = deposit.tx

    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: { depositTx },
      }),
      prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: depositTx,
          amount: link.amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: senderAddress,
        },
      }),
    ])

    res.json({ success: true, depositTx })
  } catch (err: any) {
    console.error('❌ DEPOSIT ERROR:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
