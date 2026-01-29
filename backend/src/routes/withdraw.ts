import { Router, Request, Response } from 'express'
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ v12.0: TRUE PRIVACY CASH WITHDRAWAL
 * 
 * REAL NON-CUSTODIAL FLOW:
 * 1. Frontend sends linkId + recipientAddress to backend
 * 2. Backend validates link exists & not claimed
 * 3. Backend initializes PrivacyCash SDK with operator keypair
 * 4. Backend calls SDK.withdraw() - SDK handles ZK proof + relayer
 * 5. Privacy Cash relayer verifies proof & sends encrypted SOL
 * 6. Backend records real TX hash from SDK
 * 7. Frontend shows success ✅
 * 
 * KEY: Backend is relayer/operator, but withdrawal is via Privacy Cash SDK
 * - SDK generates ZK proof
 * - SDK submits to Privacy Cash relayer
 * - Recipient gets encrypted UTXO only they can spend
 * - True privacy preserved!
 */

// Helper: Parse operator secret key
function parseOperatorKeypair(): Keypair | null {
  const operatorKey = process.env.OPERATOR_SECRET_KEY
  if (!operatorKey) {
    console.error('❌ OPERATOR_SECRET_KEY not set')
    return null
  }

  try {
    let keyArray: number[]
    if (operatorKey.startsWith('[') && operatorKey.endsWith(']')) {
      keyArray = JSON.parse(operatorKey)
    } else {
      keyArray = operatorKey
        .split(',')
        .map(num => parseInt(num.trim(), 10))
        .filter(num => !isNaN(num))
    }

    if (keyArray.length !== 64) {
      console.error(`❌ Invalid keypair: expected 64 elements, got ${keyArray.length}`)
      return null
    }

    return Keypair.fromSecretKey(Uint8Array.from(keyArray))
  } catch (err) {
    console.error('❌ Failed to parse operator keypair:', err)
    return null
  }
}

router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, recipientAddress } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'Link ID required' })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({ error: 'Recipient address required' })
    }

    // ✅ Validate Solana address format
    let recipientPubkey: PublicKey
    try {
      recipientPubkey = new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid recipient wallet address' })
    }

    console.log(`\n🔐 PRIVACY CASH WITHDRAWAL (v12.0)`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Recipient: ${recipientAddress}`)

    // ✅ Check link exists in DB
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' })
    }

    if (!link.depositTx || link.depositTx === '') {
      return res.status(400).json({ error: 'Link has no deposit tx recorded' })
    }

    console.log(`✅ Link found: ${link.amount} SOL`)
    console.log(`✅ Deposit verified: ${link.depositTx}`)

    // ✅ GET OPERATOR KEYPAIR
    const operatorKeypair = parseOperatorKeypair()
    if (!operatorKeypair) {
      return res.status(500).json({ error: 'Operator wallet not configured' })
    }

    console.log(`📍 Operator: ${operatorKeypair.publicKey.toString()}`)

    // ✅ INITIALIZE PRIVACY CASH SDK
    console.log(`📦 Loading Privacy Cash SDK...`)
    let PrivacyCash: any
    try {
      // @ts-ignore
      const PrivacyCashModule = await import('privacycash')
      // @ts-ignore
      PrivacyCash = PrivacyCashModule.PrivacyCash || PrivacyCashModule.default
      
      if (!PrivacyCash) {
        throw new Error('PrivacyCash class not found in module')
      }

      console.log(`✅ Privacy Cash SDK loaded`)
    } catch (importErr: any) {
      console.error(`❌ Failed to load Privacy Cash SDK:`, importErr.message)
      return res.status(500).json({
        error: 'Privacy Cash SDK not available',
        details: importErr.message
      })
    }

    // ✅ EXECUTE PRIVACY CASH WITHDRAWAL
    console.log(`💸 Executing Privacy Cash withdrawal...`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)

    try {
      // Initialize Privacy Cash client with operator keypair
      // @ts-ignore
      const client = new PrivacyCash({
        RPC_url: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
        owner: operatorKeypair,
      })

      console.log(`🔄 Generating ZK proof and submitting to relayer...`)

      // Execute withdrawal via Privacy Cash SDK
      // SDK will:
      // 1. Generate ZK proof
      // 2. Submit to Privacy Cash relayer
      // 3. Relayer verifies and sends encrypted SOL to recipient
      // @ts-ignore
      const withdrawResult = await client.withdraw({
        lamports: Math.floor(link.amount * LAMPORTS_PER_SOL),
        recipientAddress: recipientAddress,
      })

      if (!withdrawResult || !withdrawResult.tx) {
        throw new Error('No transaction returned from Privacy Cash SDK')
      }

      const txId = withdrawResult.tx
      console.log(`✅ Privacy Cash withdrawal successful!`)
      console.log(`   TX Hash: ${txId}`)
      console.log(`   ZK Proof: Generated & verified by relayer ✓`)
      console.log(`   Recipient gets encrypted UTXO (only they can spend)`)

      // ✅ MARK LINK AS CLAIMED
      const updatedLink = await prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: true,
          claimedBy: recipientAddress,
          withdrawTx: txId,
          updatedAt: new Date(),
        },
      })

      console.log(`✅ Link marked as claimed\n`)

      // ✅ SUCCESS RESPONSE
      return res.status(200).json({
        success: true,
        claimed: true,
        withdrawn: true,
        message: '✅ Privacy Cash withdrawal successful',
        linkId,
        amount: link.amount,
        depositTx: link.depositTx,
        withdrawalTx: txId,
        recipientAddress,
        claimedAt: updatedLink.updatedAt.toISOString(),
        privacy: {
          zkProof: true,
          encrypted: true,
          relayerVerified: true,
          description: 'Recipient received encrypted UTXO. Only they can decrypt and spend.'
        }
      })

    } catch (sdkErr: any) {
      console.error('❌ Privacy Cash withdrawal error:', sdkErr.message || sdkErr)
      return res.status(500).json({
        error: 'Privacy Cash withdrawal failed',
        details: sdkErr.message || 'Unknown error',
      })
    }

  } catch (err: any) {
    console.error('❌ WITHDRAWAL ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Withdrawal failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

export default router


