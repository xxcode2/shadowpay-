import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { Keypair, PublicKey, Connection, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
// @ts-ignore - tweetnacl types not in npm registry
import nacl from 'tweetnacl'

const router = Router()

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet'
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (SOLANA_NETWORK === 'mainnet'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com')

// ------------------ OPERATOR KEYPAIR ------------------
function getOperatorKeypair(): Keypair {
  const secret = process.env.OPERATOR_SECRET_KEY
  if (!secret) {
    console.warn('⚠️ OPERATOR_SECRET_KEY not set — using ephemeral keypair (TEST ONLY)')
    return Keypair.generate()
  }

  const arr = secret.split(',').map(n => parseInt(n.trim(), 10))
  if (arr.length !== 64) {
    throw new Error('Invalid OPERATOR_SECRET_KEY format (must be 64 numbers)')
  }

  return Keypair.fromSecretKey(new Uint8Array(arr))
}

// ------------------ CLAIM LINK ------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress, signature } = req.body

    if (!linkId || !recipientAddress || !signature) {
      return res.status(400).json({
        error: 'Missing required parameters: linkId, recipientAddress, signature',
      })
    }

    // 🔐 VERIFY SIGNATURE
    const message = new TextEncoder().encode('Privacy Money account sign in')
    const isValid = nacl.sign.detached.verify(
      message,
      Buffer.from(signature, 'hex'),
      new PublicKey(recipientAddress).toBytes()
    )

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid wallet signature' })
    }

    // 🔍 FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (!link.depositTx) return res.status(400).json({ error: 'Link has no deposit' })
    if (link.claimed) return res.status(400).json({ error: 'Link already claimed' })

    const operator = getOperatorKeypair()
    const connection = new Connection(SOLANA_RPC_URL)

    // 1️⃣ WITHDRAW FROM PRIVACYCASH (to operator)
    const privacyCash = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      owner: operator,
      enableDebug: false,
    } as any)

    console.log(`🚀 Withdrawing from PrivacyCash for link ${linkId}`)
    const withdrawResult = await privacyCash.withdraw({
      lamports: link.amount,
    })

    console.log('✅ PrivacyCash withdraw tx:', withdrawResult.tx)

    // 2️⃣ TRANSFER SOL TO RECIPIENT
    const transferTx = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: operator.publicKey,
          toPubkey: new PublicKey(recipientAddress),
          lamports: link.amount,
        })
      ),
      [operator]
    )

    console.log('✅ Transfer to recipient tx:', transferTx)

    // 3️⃣ ATOMIC CLAIM UPDATE
    const updated = await prisma.paymentLink.updateMany({
      where: { id: linkId, claimed: false },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx: transferTx,
      },
    })

    if (updated.count !== 1) {
      return res.status(400).json({ error: 'Link already claimed or invalid' })
    }

    // 4️⃣ RECORD TRANSACTION
    await prisma.transaction.create({
      data: {
        type: 'withdraw',
        linkId,
        transactionHash: transferTx,
        amount: link.amount,
        assetType: link.assetType,
        status: 'confirmed',
        toAddress: recipientAddress,
      },
    })

    return res.json({
      success: true,
      linkId,
      withdrawTx: transferTx,
      message: 'Link claimed successfully',
    })
  } catch (err) {
    console.error('❌ Claim error:', err)
    return res.status(500).json({ error: 'Claim failed' })
  }
})

export default router
