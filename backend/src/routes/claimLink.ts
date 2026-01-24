import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { Keypair, Connection } from '@solana/web3.js'

const router = Router()

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com'

// 🚨 OPERATOR = WAJIB ADA, TIDAK BOLEH FALLBACK
function getOperatorKeypair(): Keypair {
  let secret = process.env.OPERATOR_SECRET_KEY
  if (!secret) {
    throw new Error('OPERATOR_SECRET_KEY not set')
  }

  secret = secret.replace(/^["']|["']$/g, '')
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
      return res.status(400).json({ error: 'Missing parameters' })
    }

    console.log(`📥 Claim request: linkId=${linkId}, recipient=${recipientAddress}`)

    const link = await prisma.paymentLink.findUnique({ where: { id: linkId } })
    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (!link.depositTx) return res.status(400).json({ error: 'No deposit' })
    if (link.claimed) return res.status(400).json({ error: 'Already claimed' })

    console.log(`✅ Link found: ${link.amount} ${link.assetType}, depositTx: ${link.depositTx}`)

    const operator = getOperatorKeypair()
    console.log(`📝 Operator: ${operator.publicKey.toString()}`)

    // 🔍 CHECK OPERATOR BALANCE BEFORE WITHDRAW
    try {
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
      const balance = await connection.getBalance(operator.publicKey)
      console.log(`💰 Operator balance: ${balance / 1e9} SOL`)
      
      if (balance < 5000000) {  // Less than 0.005 SOL
        console.warn(`⚠️  Operator balance low: ${balance / 1e9} SOL (recommend > 0.1 SOL)`)
      }
    } catch (err) {
      console.error('⚠️  Could not check operator balance:', err)
    }

    const pc = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      owner: operator,
      enableDebug: true,
    } as any)

    // ✅ FIX UTAMA: SOL → LAMPORTS
    const lamports = Math.round(link.amount * 1e9)
    console.log(`🔄 Withdrawing: ${lamports} lamports (${link.amount} SOL)`)

    console.log(`🚀 Calling PrivacyCash.withdraw()...`)
    const withdraw = await pc.withdraw({
      lamports,
      recipientAddress,
    })

    const withdrawTx = withdraw.tx
    console.log(`✅ Withdraw executed: ${withdrawTx}`)

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

    console.log(`✅ Link ${linkId} claimed and recorded in DB`)
    res.json({ success: true, withdrawTx })
  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err.message)
    console.error('Stack:', err.stack)
    res.status(500).json({ error: err.message || 'Withdrawal failed' })
  }
})

export default router
