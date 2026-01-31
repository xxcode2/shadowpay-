import { Router, Request, Response } from 'express'
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'

const router = Router()

/**
 * PRIVATE SEND - Create a private payment with recipient identity
 *
 * This is the CORRECT Privacy Cash model:
 * - Sender specifies recipient wallet at deposit time
 * - UTXO ownership is bound to recipient
 * - Only recipient can withdraw
 * - No bearer links
 */

// Get operator address from env
function getOperatorAddress(): string {
  const operatorKey = process.env.OPERATOR_SECRET_KEY
  if (!operatorKey) {
    throw new Error('OPERATOR_SECRET_KEY not configured')
  }

  try {
    let keyArray: number[]
    if (operatorKey.startsWith('[') && operatorKey.endsWith(']')) {
      keyArray = JSON.parse(operatorKey)
    } else {
      keyArray = operatorKey.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
    }

    if (keyArray.length !== 64) {
      throw new Error('Invalid key length')
    }

    const keypair = Keypair.fromSecretKey(Uint8Array.from(keyArray))
    return keypair.publicKey.toString()
  } catch (err) {
    throw new Error('Failed to parse operator key')
  }
}

/**
 * POST /api/private-send
 *
 * Create a new private payment. Returns payment ID and operator address
 * for the sender to transfer SOL to.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { amount, senderAddress, recipientAddress } = req.body

    // Validate inputs
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' })
    }

    if (!senderAddress || typeof senderAddress !== 'string') {
      return res.status(400).json({ error: 'Sender address required' })
    }

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({ error: 'Recipient address required' })
    }

    // Validate Solana addresses
    try {
      new PublicKey(senderAddress)
      new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid Solana address format' })
    }

    // Get operator address
    const operatorAddress = getOperatorAddress()

    // Generate payment ID
    const paymentId = crypto.randomBytes(16).toString('hex')
    const lamports = Math.round(amount * LAMPORTS_PER_SOL)

    console.log(`\n📤 PRIVATE SEND INITIATED`)
    console.log(`   Payment ID: ${paymentId}`)
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   From: ${senderAddress}`)
    console.log(`   To: ${recipientAddress}`)

    // Create payment link record with recipient specified
    // Note: Using PaymentLink model but with recipientAddress field
    const payment = await prisma.paymentLink.create({
      data: {
        id: paymentId,
        amount: amount,
        lamports: BigInt(lamports),
        assetType: 'SOL',
        claimed: false,
        // Store recipient in claimedBy field (will be the owner)
        // This is a workaround - ideally we'd have a recipientAddress field
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Also create a transaction record to track sender and recipient
    // The transactionHash will be set to pending_${paymentId} initially
    // It will be updated when the actual deposit transaction is confirmed
    await prisma.transaction.create({
      data: {
        linkId: paymentId,
        type: 'pending',
        status: 'pending',
        amount: amount,
        assetType: 'SOL',
        fromAddress: senderAddress,
        toAddress: recipientAddress,
        transactionHash: `pending-${paymentId}`,  // ✅ Unique pending marker
      },
    })

    console.log(`✅ Payment record created`)

    return res.status(200).json({
      paymentId,
      operatorAddress,
      lamports,
      amount,
      recipientAddress,
    })

  } catch (err: any) {
    console.error('❌ Private send error:', err.message)
    return res.status(500).json({ error: err.message || 'Failed to create payment' })
  }
})

/**
 * POST /api/private-send/confirm
 *
 * Confirm that the user successfully deposited to Privacy Cash.
 * The deposit was already completed by the frontend using the user's keys.
 * This endpoint just marks the payment as confirmed in our database.
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentId, depositTx } = req.body

    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Payment ID required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'Deposit transaction required' })
    }

    console.log(`\n✅ CONFIRMING PRIVATE SEND`)
    console.log(`   Payment ID: ${paymentId}`)
    console.log(`   Privacy Cash TX: ${depositTx}`)

    // Get payment details to verify it exists
    const payment = await prisma.paymentLink.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    // Update database to mark as confirmed
    console.log(`   📝 Recording Privacy Cash deposit...`)
    await prisma.paymentLink.update({
      where: { id: paymentId },
      data: {
        depositTx: depositTx,
        updatedAt: new Date(),
      },
    })

    // Update transaction record to confirmed status
    // Find and update ONLY the first pending transaction for this payment
    try {
      // First find the transaction we created
      const pendingTx = await prisma.transaction.findFirst({
        where: {
          linkId: paymentId,
          type: 'pending',
        },
      })

      if (pendingTx) {
        // Update only this specific transaction
        await prisma.transaction.update({
          where: { id: pendingTx.id },
          data: {
            type: 'deposit',
            status: 'confirmed',
            transactionHash: depositTx,
          },
        })
        console.log(`     ✅ Transaction confirmed with hash: ${depositTx.substring(0, 20)}...`)
      } else {
        console.warn(`   ⚠️  No pending transaction found for payment ${paymentId}`)
        // Try to find any existing transaction and update it
        const existingTx = await prisma.transaction.findFirst({
          where: { linkId: paymentId },
        })

        if (existingTx && existingTx.status !== 'confirmed') {
          console.log(`     Found existing transaction, updating it...`)
          await prisma.transaction.update({
            where: { id: existingTx.id },
            data: {
              type: 'deposit',
              status: 'confirmed',
              transactionHash: depositTx,
            },
          })
        } else if (!existingTx) {
          // Create new transaction if none exists (shouldn't happen but just in case)
          const payment = await prisma.paymentLink.findUnique({
            where: { id: paymentId },
          })

          if (payment) {
            console.log(`     Creating new transaction record...`)
            await prisma.transaction.create({
              data: {
                linkId: paymentId,
                type: 'deposit',
                status: 'confirmed',
                amount: payment.amount || 0,
                assetType: 'SOL',
                transactionHash: depositTx,
              },
            })
          }
        }
      }
    } catch (txErr: any) {
      // Log but don't fail if transaction update has issues
      // The payment is still valid on Privacy Cash
      console.warn(`   ⚠️  Transaction update warning: ${txErr.message}`)
      console.warn(`   ⚠️  The payment is still valid on Privacy Cash. Backend record may be incomplete.`)
    }

    console.log(`✅ Payment confirmed - recipient can now withdraw from Privacy Cash pool`)

    return res.status(200).json({
      success: true,
      paymentId,
      depositTx,
      message: 'Payment confirmed and ready for withdrawal',
    })

  } catch (err: any) {
    console.error('❌ Confirm error:', err.message)
    return res.status(500).json({ error: err.message || 'Failed to confirm payment' })
  }
})

export default router
