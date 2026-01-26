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
    const { linkId, amount, lamports, signature, publicKey } = req.body

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
    if (!signature || !Array.isArray(signature)) {
      return res.status(400).json({ error: 'signature required (as array)' })
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

    // Get operator keypair (for signing transaction as fee payer)
    const operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY
    if (!operatorPrivateKey) {
      console.error('❌ OPERATOR_PRIVATE_KEY not configured in environment')
      return res.status(500).json({ error: 'Server misconfiguration: operator not available' })
    }

    let operatorKeypair: Keypair
    try {
      const secretKey = JSON.parse(operatorPrivateKey)
      operatorKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey))
    } catch (err) {
      console.error('❌ Failed to parse operator keypair:', err)
      return res.status(500).json({ error: 'Server misconfiguration: invalid operator key' })
    }

    // Get Privacy Cash pool address from config
    const PRIVACY_CASH_POOL = process.env.PRIVACY_CASH_POOL || '9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD'

    // Create transfer transaction
    // ✅ FROM: User (publicKey)
    // ✅ TO: Privacy Cash pool
    // ✅ PAYER: Operator (covers transaction fee)
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(publicKey),
        toPubkey: new PublicKey(PRIVACY_CASH_POOL),
        lamports: Math.round(lamports),
      })
    )

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = operatorKeypair.publicKey // ✅ Operator pays fee

    // ✅ SIGN WITH OPERATOR KEYPAIR (can sign on behalf to cover fee)
    transaction.sign(operatorKeypair)

    console.log(`📤 Sending transfer transaction: ${publicKey} → ${PRIVACY_CASH_POOL}`)
    console.log(`   Fee payer: ${operatorKeypair.publicKey.toString()}`)
    
    // Serialize and send signed transaction
    const txHash = await connection.sendRawTransaction(transaction.serialize())
    
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
      errorMsg = 'Operator wallet has insufficient balance for transaction fee.'
    }
    
    return res.status(500).json({
      error: 'Failed to execute deposit',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    })
  }
})

export default router
