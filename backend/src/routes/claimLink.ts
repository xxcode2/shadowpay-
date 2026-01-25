import { Router, Request, Response } from 'express'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { assertOperatorBalance } from '../utils/operatorBalanceGuard.js'

const router = Router()

const RPC = process.env.SOLANA_RPC_URL!
const operatorSecret = process.env.OPERATOR_SECRET_KEY!

function getOperator(): Keypair {
  const arr = operatorSecret.replace(/^["']|["']$/g, '').split(',').map(Number)
  if (arr.length !== 64) throw new Error('Invalid OPERATOR_SECRET_KEY')
  return Keypair.fromSecretKey(new Uint8Array(arr))
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress } = req.body

    if (!linkId || !recipientAddress) {
      return res.status(400).json({ error: 'linkId and recipientAddress required' })
    }

    const link = await prisma.paymentLink.findUnique({ where: { id: linkId } })
    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (!link.depositTx) return res.status(400).json({ error: 'Link has no deposit' })
    if (link.claimed) return res.status(400).json({ error: 'Already claimed' })

    const operator = getOperator()
    const connection = new Connection(RPC)

    // ✅ SOURCE OF TRUTH: lamports from DB (no rounding)
    const lamports = link.lamports

    // ✅ BALANCE GUARD (before withdraw execution)
    await assertOperatorBalance(connection, operator.publicKey, Number(lamports))

    const pc = new PrivacyCash({
      RPC_url: RPC,
      owner: operator,
    } as any)

    // ✅ REAL WITHDRAW (backend executes, returns tx hash)
    const { tx: withdrawTx } = await pc.withdraw({
      lamports,
      recipientAddress,
    })

    // ✅ ATOMIC transaction - update link + record withdrawal
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
          lamports,
          assetType: link.assetType,
          status: 'confirmed',
          toAddress: recipientAddress,
        },
      }),
    ])

    console.log(`✅ Link ${linkId} claimed by ${recipientAddress} | Withdraw tx: ${withdrawTx}`)

    res.json({ success: true, withdrawTx })
  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
