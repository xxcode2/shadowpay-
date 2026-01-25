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
 * REAL PrivacyCash withdrawal - Operator acts as RELAYER
 *
 * Flow:
 * 1. Frontend sends linkId + recipientAddress
 * 2. Backend verifies link + deposit exists
 * 3. Backend checks operator has fee buffer (0.01 SOL)
 * 4. Backend executes REAL PrivacyCash.withdraw() as RELAYER
 * 5. Backend records withdrawal transaction atomically
 *
 * CRITICAL:
 * - Operator is RELAYER only (pays network fees, not withdrawal amount)
 * - PrivacyCash handles the actual fund transfer (encrypted circuit proof)
 * - Operator balance guard checks FEE safety only, not withdrawal amount
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

    // 🔒 BALANCE GUARD: Check operator has fee buffer only (NOT withdrawal amount)
    // PrivacyCash handles the actual fund transfer, operator only pays network fees
    await assertOperatorBalance(
      connection,
      operator.publicKey,
      0.01 * LAMPORTS_PER_SOL  // FEE safety buffer only
    )

    console.log(`🚀 Executing REAL PrivacyCash withdrawal for link ${linkId}`)
    console.log(`📤 Operator (relayer): ${operator.publicKey.toString()}`)
    console.log(`🎯 Recipient: ${recipientAddress}`)
    console.log(`💰 Amount: ${(link.amount).toFixed(6)} SOL (${Number(link.lamports)} lamports)`)

    // ✅ Create PrivacyCash instance with operator as RELAYER
    const pc = new PrivacyCash({
      owner: operator,
      RPC_url: RPC,
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
