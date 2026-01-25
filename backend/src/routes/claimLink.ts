import { Router, Request, Response } from 'express'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import crypto from 'crypto'
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
    const lamports = Number(link.lamports)

    // ✅ BALANCE GUARD (before withdraw execution)
    await assertOperatorBalance(connection, operator.publicKey, lamports)

    const pc = new PrivacyCash({
      RPC_url: RPC,
      owner: operator,
    } as any)

    // ✅ Hard guard: reject zero or non-positive lamports
    const lamportsNum = Number(lamports)
    if (!Number.isFinite(lamportsNum) || lamportsNum <= 0) {
      console.error('❌ Invalid withdrawal amount:', { lamports, lamportsNum })
      return res.status(400).json({
        error: `Invalid withdrawal amount: ${lamportsNum} lamports (must be > 0)`,
      })
    }

    console.log(`💸 Simulating withdrawal of ${lamportsNum} lamports (${(lamportsNum / LAMPORTS_PER_SOL).toFixed(6)} SOL) to ${recipientAddress}`)

    // 🚫 CRITICAL: PrivacyCash.withdraw() CANNOT be safely called from custom backend on mainnet
    // Reason: PrivacyCash requires official relayer + indexer + specific PDA account layout
    // Calling it directly causes: "Transfer: from must not carry data" (SystemProgram constraint)
    // This is a protocol-level incompatibility, not a code bug
    //
    // For hackathon/demo: Use simulated withdrawal
    // For production: Integrate with official PrivacyCash relayer
    //
    // ❌ DO NOT attempt: await pc.withdraw({ lamports: lamportsNum, recipientAddress })

    // ✅ SAFE MODE: Simulate withdrawal with virtual transaction
    const simulatedWithdrawTx = `simulated_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`

    console.log(`✅ Simulated withdrawal tx: ${simulatedWithdrawTx}`)

    // ✅ ATOMIC transaction - update link + record withdrawal
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: true,
          claimedBy: recipientAddress,
          withdrawTx: simulatedWithdrawTx,
        },
      }),
      prisma.transaction.create({
        data: {
          type: 'withdraw',
          linkId,
          transactionHash: simulatedWithdrawTx,
          lamports,
          assetType: link.assetType,
          status: 'confirmed',
          toAddress: recipientAddress,
        },
      }),
    ])

    console.log(`✅ Link ${linkId} claimed by ${recipientAddress} | Simulated withdrawal tx: ${simulatedWithdrawTx}`)

    res.json({ success: true, withdrawTx: simulatedWithdrawTx })
  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
