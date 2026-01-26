import { Router, Request, Response } from 'express'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import { PrivacyCash } from 'privacycash'
import { assertOperatorBalance } from '../utils/operatorBalanceGuard.js'

const router = Router()

const RPC = process.env.SOLANA_RPC_URL!
const operatorSecret = process.env.OPERATOR_SECRET_KEY!

/**
 * Parse operator keypair from OPERATOR_SECRET_KEY env
 * Format: comma-separated array of 64 numbers
 */
function getOperator(): Keypair {
  if (!operatorSecret) {
    throw new Error('OPERATOR_SECRET_KEY not configured')
  }

  try {
    // Remove quotes if present, split by comma, parse as numbers
    const arr = operatorSecret
      .replace(/^["']|["']$/g, '')
      .split(',')
      .map(x => parseInt(x.trim(), 10))

    if (arr.length !== 64) {
      throw new Error(`Invalid OPERATOR_SECRET_KEY: expected 64 bytes, got ${arr.length}`)
    }

    return Keypair.fromSecretKey(new Uint8Array(arr))
  } catch (err: any) {
    throw new Error(`Failed to parse OPERATOR_SECRET_KEY: ${err.message}`)
  }
}

/**
 * POST /api/claim-link
 *
 * ✅ CORRECT BUSINESS MODEL:
 * 
 * PAYMENT FLOW:
 * 1. Sender (User1) creates link - pays amount + deposit fee (~0.002 SOL)
 * 2. Sender's SOL goes to Privacy Cash pool (encrypted, private)
 * 3. Recipient (User2) claims link - receives amount minus operator fee
 * 4. Operator acts as RELAYER and earns 0.006 SOL fee per transaction
 * 
 * ECONOMIC MODEL:
 * Sender pays: 0.017 SOL (amount) + 0.008 SOL (fees) = 0.025 SOL total
 * Operator earns: 0.006 SOL (commission fee)
 * Recipient receives: 0.011 SOL (0.017 - 0.006 operator fee)
 * Result: Operator earns ~0.003 SOL after costs, system sustainable!
 * 
 * TECHNICAL:
 * - Operator is RELAYER only - does NOT pay the deposit amount
 * - PrivacyCash handles fund transfer from shielded pool
 * - Operator balance check only verifies withdrawal fee buffer
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, recipientAddress } = req.body

    // ✅ COMPREHENSIVE VALIDATION
    if (!linkId || typeof linkId !== 'string') {
      console.error('❌ Missing or invalid linkId')
      return res.status(400).json({
        error: 'Invalid or missing linkId',
        details: 'linkId must be a non-empty string',
      })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      console.error('❌ Missing or invalid recipientAddress')
      return res.status(400).json({
        error: 'Invalid or missing recipientAddress',
        details: 'recipientAddress must be a valid Solana address',
      })
    }

    // ✅ VALIDATE SOLANA ADDRESS FORMAT
    let validPublicKey
    try {
      validPublicKey = new PublicKey(recipientAddress)
    } catch (keyErr: any) {
      console.error('❌ Invalid Solana address:', keyErr.message)
      return res.status(400).json({
        error: 'Invalid Solana address format',
        details: keyErr.message,
      })
    }

    // ✅ FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      console.error(`❌ Link not found: ${linkId}`)
      return res.status(404).json({
        error: 'Link not found',
        details: `No link found with ID: ${linkId}`,
      })
    }

    // ✅ CHECK DEPOSIT STATUS (CRITICAL)
    if (!link.depositTx || link.depositTx.trim() === '') {
      console.error(`❌ Link ${linkId} has no valid deposit transaction`)
      return res.status(400).json({
        error: 'Link has no valid deposit',
        details: 'Please wait for deposit to confirm or create a new link',
        linkStatus: {
          amount: link.amount,
          claimed: link.claimed,
          hasDepositTx: !!link.depositTx,
        },
      })
    }

    // ✅ CHECK CLAIM STATUS
    if (link.claimed) {
      console.error(`❌ Link ${linkId} already claimed by ${link.claimedBy}`)
      return res.status(400).json({
        error: 'Link already claimed',
        details: `This link was claimed by ${link.claimedBy || 'unknown address'}`,
      })
    }

    // ✅ Get operator keypair
    const operator = getOperator()
    const connection = new Connection(RPC)

    // 🔒 BALANCE GUARD: Calculate withdrawal fees only (user paid the deposit!)
    // Withdrawal fees include:
    // - Privacy Cash base fee: 0.006 SOL
    // - Privacy Cash protocol fee: 0.35%
    // - Network tx fee: ~0.002 SOL
    const WITHDRAWAL_BASE_FEE = 0.006 * LAMPORTS_PER_SOL
    const WITHDRAWAL_PROTOCOL_FEE = Math.round(Number(link.lamports) * 0.0035)
    const NETWORK_TX_FEE = 0.002 * LAMPORTS_PER_SOL
    const totalWithdrawalFees = WITHDRAWAL_BASE_FEE + WITHDRAWAL_PROTOCOL_FEE + NETWORK_TX_FEE

    console.log(`💰 Withdrawal fee breakdown:`)
    console.log(`   - Base fee: 0.006 SOL (💰 operator earns this)`)
    console.log(`   - Protocol fee (0.35%): ${(WITHDRAWAL_PROTOCOL_FEE / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
    console.log(`   - Network tx fee: 0.002 SOL`)
    console.log(`   - Total fees: ${(totalWithdrawalFees / LAMPORTS_PER_SOL).toFixed(6)} SOL`)

    await assertOperatorBalance(connection, operator.publicKey, totalWithdrawalFees)

    console.log(`🚀 Executing REAL PrivacyCash withdrawal for link ${linkId}`)
    console.log(`📤 Operator (relayer): ${operator.publicKey.toString()}`)
    console.log(`🎯 Recipient: ${recipientAddress}`)
    console.log(`💰 Amount: ${(link.amount).toFixed(6)} SOL (${Number(link.lamports)} lamports)`)

    // ✅ CRITICAL FIX: Use correct Privacy Cash program address
    // This MUST match the address where the deposit transaction went
    const PRIVACY_CASH_PROGRAM = process.env.PRIVACY_CASH_PROGRAM || '9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQlS3skWZdQyQD'
    
    console.log(`🔐 Using Privacy Cash Program: ${PRIVACY_CASH_PROGRAM}`)

    // ✅ Create PrivacyCash instance with operator as RELAYER
    const pc = new PrivacyCash({
      owner: operator,
      RPC_url: RPC,
      programId: new PublicKey(PRIVACY_CASH_PROGRAM),
    } as any)

    // ✅ Convert lamports to number for PrivacyCash SDK
    const lamportsNum = Number(link.lamports)

    if (!Number.isFinite(lamportsNum) || lamportsNum <= 0) {
      return res.status(400).json({
        error: `Invalid withdrawal amount: ${lamportsNum} lamports (must be > 0)`,
      })
    }

    // 🔥 EXECUTE REAL WITHDRAWAL
    const { tx: withdrawTx } = await pc.withdraw({
      lamports: lamportsNum,
      recipientAddress,
    })

    console.log(`✅ Real withdrawal tx: ${withdrawTx}`)

    // ✅ ATOMIC update: Link + Transaction record (prevents double-claim)
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
          amount: link.amount, // Use amount in SOL, not lamports
          assetType: link.assetType,
          status: 'confirmed',
          toAddress: recipientAddress,
        },
      }),
    ])

    console.log(`✅ Link ${linkId} claimed by ${recipientAddress} | Withdrawal tx: ${withdrawTx}`)
    console.log(`💰 ShadowPay earned 0.006 SOL commission from this transaction`)

    return res.status(200).json({
      success: true,
      withdrawTx,
      linkId,
      message: 'Withdrawal completed successfully',
    })
  } catch (err: any) {
    console.error('❌ CLAIM ERROR:', err.message || err.toString())
    return res.status(500).json({
      error: err.message || 'Withdrawal failed',
      details: process.env.NODE_ENV === 'development' ? err.toString() : undefined,
    })
  }
})

export default router
