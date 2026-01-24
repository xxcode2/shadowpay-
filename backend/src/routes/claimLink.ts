import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { Keypair } from '@solana/web3.js'

const router = Router()

const RPC =
  process.env.SOLANA_RPC_URL ||
  'https://api.devnet.solana.com'

function getOperator(): Keypair {
  const secret = process.env.OPERATOR_SECRET_KEY
  if (!secret) throw new Error('OPERATOR_SECRET_KEY not set')

  const arr = secret.split(',').map(n => Number(n))
  return Keypair.fromSecretKey(new Uint8Array(arr))
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress, signature } = req.body

    console.log('📥 CLAIM BODY:', req.body)

    if (!linkId || !recipientAddress || !signature) {
      return res.status(400).json({
        error: 'Missing required parameters: linkId, recipientAddress, signature',
      })
    }

    const link = await prisma.paymentLink.findUnique({ where: { id: linkId } })

    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (!link.depositTx) return res.status(400).json({ error: 'No deposit' })
    if (link.claimed) return res.status(400).json({ error: 'Already claimed' })

    console.log('🚀 Executing PrivacyCash.withdraw()')

    const pc = new PrivacyCash({
      RPC_url: RPC,
      owner: getOperator(),
    } as any)

    const withdraw = await pc.withdraw({
      lamports: link.amount,
      recipientAddress,
    })

    const withdrawTx = withdraw.tx

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
          status: 'confirmed',
          toAddress: recipientAddress,
        },
      }),
    ])

    console.log(`✅ Link ${linkId} claimed`)

    res.json({
      success: true,
      linkId,
      withdrawTx,
    })
  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
