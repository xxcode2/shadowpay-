import { Router, Request, Response } from 'express'
import { PublicKey, Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ v11.0: BACKEND-WITHDRAW WITH REAL SOL TRANSFER
 * 
 * REAL WORKING FLOW:
 * 1. Frontend sends linkId + recipientAddress
 * 2. Backend validates link exists & not claimed
 * 3. Backend sends real SOL from operator wallet to recipient
 * 4. Backend marks link claimed with REAL TX hash
 * 5. Frontend shows success
 * 
 * HACKATHON READY: Uses operator keypair to send real SOL
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

    console.log(`\n💸 PROCESSING WITHDRAWAL`)
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

    // ✅ CONNECT TO SOLANA RPC
    const rpcUrl = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')

    console.log(`🌐 RPC: ${rpcUrl}`)

    // ✅ CHECK OPERATOR BALANCE
    const operatorBalance = await connection.getBalance(operatorKeypair.publicKey)
    const operatorBalanceSOL = operatorBalance / LAMPORTS_PER_SOL
    console.log(`💰 Operator balance: ${operatorBalanceSOL.toFixed(6)} SOL`)

    const lamportsToSend = Math.floor(link.amount * LAMPORTS_PER_SOL)
    if (operatorBalance < lamportsToSend + 5000) {
      console.error(`❌ Insufficient operator balance: need ${(lamportsToSend / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
      return res.status(400).json({
        error: 'Operator wallet has insufficient balance',
        needed: (lamportsToSend / LAMPORTS_PER_SOL).toFixed(6),
        available: operatorBalanceSOL.toFixed(6),
      })
    }

    // ✅ BUILD & SEND TRANSACTION
    console.log(`💸 Sending ${link.amount} SOL...`)

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: operatorKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports: lamportsToSend,
        })
      )

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = operatorKeypair.publicKey

      // Sign and send
      const txId = await sendAndConfirmTransaction(connection, transaction, [operatorKeypair], {
        maxRetries: 3,
        commitment: 'confirmed',
      })

      console.log(`✅ SOL sent! TX: ${txId}`)

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
        message: '✅ SOL transferred successfully',
        linkId,
        amount: link.amount,
        depositTx: link.depositTx,
        withdrawalTx: txId,
        recipientAddress,
        claimedAt: updatedLink.updatedAt.toISOString(),
      })

    } catch (txErr: any) {
      console.error('❌ Transaction failed:', txErr.message)
      return res.status(500).json({
        error: 'Transaction failed',
        details: txErr.message || 'Unknown error',
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

