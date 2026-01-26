import { Router, Request, Response } from 'express'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { assertOperatorBalance } from '../utils/operatorBalanceGuard.js'

const router = Router()
const RPC = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com'

function getOperator(): Keypair {
  const secretKeyStr = process.env.OPERATOR_SECRET_KEY
  if (!secretKeyStr) throw new Error('OPERATOR_SECRET_KEY not set in environment variables')
  
  try {
    // Handle multiple format private key secara robust
    let keyArray: number[]
    
    // Format 1: JSON array string "[1,2,3,...]"
    if (secretKeyStr.startsWith('[') && secretKeyStr.endsWith(']')) {
      keyArray = JSON.parse(secretKeyStr)
    } 
    // Format 2: Comma-separated string "1,2,3,..."
    else if (/^\d+(,\s*\d+)*$/.test(secretKeyStr)) {
      keyArray = secretKeyStr.split(',').map(num => parseInt(num.trim(), 10)).filter(num => !isNaN(num))
    }
    // Format 3: JSON array string dengan quotes tambahan
    else if (/^["'][\d,\s]+["']$/.test(secretKeyStr)) {
      const cleaned = secretKeyStr.replace(/^["']|["']$/g, '')
      keyArray = JSON.parse(`[${cleaned}]`)
    }
    else {
      throw new Error('Unsupported OPERATOR_SECRET_KEY format')
    }
    
    if (keyArray.length !== 64) {
      throw new Error(`Invalid key length: ${keyArray.length} (expected 64)`)
    }
    
    const secretKey = Uint8Array.from(keyArray)
    return Keypair.fromSecretKey(secretKey)
  } catch (err: any) {
    console.error('❌ Failed to parse OPERATOR_SECRET_KEY:', err)
    console.error('Current secret key (first 20 chars):', secretKeyStr.substring(0, 20) + '...')
    throw new Error(`Invalid OPERATOR_SECRET_KEY format: ${err.message}`)
  }
}

/**
 * POST /api/deposit
 *
 * ✅ ARSITEKTUR YANG BENAR SESUAI DOKUMENTASI PRIVACY CASH:
 * 1. Frontend hanya sign message authorization (tidak ada PrivacyCash SDK)
 * 2. Backend eksekusi REAL deposit dengan operator private key (PrivacyCash SDK di backend)
 * 3. Dana masuk langsung ke Privacy Cash pool, BUKAN ke operator wallet
 * 4. Operator bertindak sebagai relayer, bukan penerima dana
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, signature, publicKey, amount } = req.body

    // ✅ Validation
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }
    if (!signature || !Array.isArray(signature)) {
      return res.status(400).json({ error: 'signature (array) required' })
    }
    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey required' })
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'valid amount required' })
    }

    // ✅ Find link
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })
    if (!link) return res.status(404).json({ error: 'Link not found' })
    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded' })
    }

    // ✅ Verify signature (optional tapi recommended)
    const message = new TextEncoder().encode(
      `Authorize deposit of ${amount} SOL to Privacy Cash pool for link ${linkId}`
    )
    
    try {
      const isValid = nacl.sign.detached.verify(
        message,
        new Uint8Array(signature),
        new PublicKey(publicKey).toBytes()
      )
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' })
      }
      console.log('✅ Signature verified successfully')
    } catch (verifyErr: any) {
      // In development, log warning but require signature verification in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [DEV MODE] Signature verification failed but continuing:', verifyErr.message)
        // In dev, we allow it to continue to allow testing without proper signing
      } else {
        return res.status(401).json({ error: `Signature verification failed: ${verifyErr.message}` })
      }
    }

    // ✅ Get operator & check balance
    // NOTE: Operator needs balance for FUTURE withdrawals (not this deposit)
    // Deposit fees are 0 SOL, only network fees ~0.002 SOL
    const operator = getOperator()
    const connection = new Connection(RPC)
    const lamports = Math.round(amount * LAMPORTS_PER_SOL)
    
    // Check operator has balance for FUTURE withdrawal fees (will charge user later)
    // Withdrawal fee = 0.006 SOL base + 0.35% of withdrawal amount
    const maxWithdrawalAmount = lamports
    const estimatedWithdrawalFee = (0.006 * LAMPORTS_PER_SOL) + (maxWithdrawalAmount * 0.0035)
    const NETWORK_FEE = 0.002 * LAMPORTS_PER_SOL
    const SAFETY_BUFFER = 0.005 * LAMPORTS_PER_SOL // Small buffer for dev testing
    
    const requiredLamports = estimatedWithdrawalFee + NETWORK_FEE + SAFETY_BUFFER
    
    try {
      await assertOperatorBalance(connection, operator.publicKey, requiredLamports)
    } catch (balanceErr: any) {
      // Jika di development, lanjutkan dengan warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Balance check failed but continuing in development mode')
        console.warn(`   Available: ${(await connection.getBalance(operator.publicKey)) / LAMPORTS_PER_SOL} SOL`)
      } else {
        throw balanceErr
      }
    }

    // ✅ Execute REAL deposit dengan PrivacyCash SDK di backend
    console.log(`🚀 Executing REAL PrivacyCash deposit for link ${linkId}`)
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   Operator (relayer): ${operator.publicKey.toString()}`)
    console.log(`   User: ${publicKey}`)

    const pc = new PrivacyCash({
      RPC_url: RPC,
      owner: operator, // Operator private key - AMAN di backend
      enableDebug: process.env.NODE_ENV === 'development',
    } as any)

    const { tx: depositTx } = await pc.deposit({ lamports })

    console.log(`✅ Deposit successful: ${depositTx}`)

    // ✅ Record in database (atomic)
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
          fromAddress: publicKey,
        },
      }),
    ])

    return res.status(200).json({
      success: true,
      depositTx,
      amount: amount,  // Deposit amount (full amount, no fee charged here)
      fee: {
        // DEPOSIT FEES (charged at deposit time)
        depositFee: 0,  // No fee for deposit
        networkFee: 0.002,  // ~0.002 SOL network fee (paid by relayer)
        
        // FUTURE WITHDRAWAL FEES (will be charged when user claims)
        withdrawalBaseFee: 0.006,
        withdrawalProtocolFeePercent: 0.35,
        note: 'Withdrawal fees (0.006 SOL + 0.35%) will be charged when recipient claims the link',
      },
      message: 'Deposit executed successfully. Link ready to claim.',
    })
  } catch (err: any) {
    console.error('❌ Deposit execution error:', err.message || err.toString())
    
    // Production: Hide sensitive error details
    const errorResponse = {
      error: process.env.NODE_ENV === 'production'
        ? 'Service temporarily unavailable'
        : err.message || 'Deposit failed',
    }
    
    // Development: Include full error trace
    if (process.env.NODE_ENV === 'development') {
      (errorResponse as any)['details'] = err.toString()
      (errorResponse as any)['stack'] = err.stack
    }
    
    return res.status(500).json(errorResponse)
  }
})

export default router
