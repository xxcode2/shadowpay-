import { Router, Request, Response } from 'express'
import { PublicKey, Connection, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * ✅ CORRECT ARCHITECTURE:
 * 1. Frontend sends: user's authorization signature + amount + publicKey
 * 2. Backend verifies: user's public key exists and has sufficient balance
 * 3. Backend executes: transfer transaction with OPERATOR keypair as fee payer
 * 4. Backend records: transaction hash in database
 * 
 * Why operator pays transaction fee:
 * - User's funds go directly to Privacy Cash pool
 * - Operator covers minimal fee (~0.00025 SOL) for the transaction
 * - Sustainable because withdrawal fees pay for this
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, amount, lamports, signedTransaction, publicKey } = req.body

    // ✅ VALIDASI INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }
    if (typeof amount !== 'string' && typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount required (as string or number)' })
    }
    if (typeof lamports !== 'number' || lamports <= 0) {
      return res.status(400).json({ error: 'valid lamports required' })
    }
    if (!signedTransaction || !Array.isArray(signedTransaction)) {
      return res.status(400).json({ error: 'signedTransaction required (as array)' })
    }
    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(publicKey)
    } catch {
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })
    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    // ✅ EXECUTE DEPOSIT ON BACKEND
    console.log(`🔄 Executing deposit for link ${linkId}...`)
    
    // Setup connection with authenticated RPC (API key in env)
    const RPC_URL = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
    const connection = new Connection(RPC_URL, 'confirmed')

    // ✅ RECONSTRUCT SIGNED TRANSACTION FROM ARRAY
    const signedTxBuffer = Buffer.from(signedTransaction)
    const txn = Transaction.from(signedTxBuffer)

    console.log(`📤 Submitting signed transaction from user: ${publicKey}`)
    
    // ✅ SUBMIT THE ALREADY-SIGNED TRANSACTION
    const txHash = await connection.sendRawTransaction(txn.serialize())
    
    // Wait for confirmation
    await connection.confirmTransaction(txHash, 'confirmed')

    console.log(`✅ Deposit executed: ${txHash}`)

    // ✅ RECORD TRANSAKSI DI DATABASE
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: { depositTx: txHash }
      }),
      prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: txHash,
          amount: link.amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        }
      })
    ])

    console.log(`✅ Deposit RECORDED successfully: ${txHash}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Link: ${linkId}`)
    
    return res.status(200).json({
      success: true,
      tx: txHash,
      amount,
      fee: {
        depositFee: 0,
        networkFee: 0.002,
        withdrawalBaseFee: 0.006,
        withdrawalProtocolFeePercent: 0.35,
        note: 'Withdrawal fees (0.006 SOL + 0.35%) will be charged when recipient claims'
      }
    })
  } catch (err: any) {
    console.error('❌ Deposit execution error:', err)
    
    let errorMsg = err.message || 'Unknown error'
    if (errorMsg.includes('403') || errorMsg.includes('Access forbidden')) {
      errorMsg = 'RPC authentication failed. Backend RPC endpoint not properly configured.'
    } else if (errorMsg.includes('Insufficient lamports')) {
      errorMsg = 'User wallet has insufficient balance for this transaction.'
    }
    
    return res.status(500).json({
      error: 'Failed to execute deposit',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    })
  }
})

export default router
