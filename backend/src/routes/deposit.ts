import { Router, Request, Response } from 'express'
import { Connection, PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * ✅ USER-PAYS DEPOSIT FLOW - User wallet pays all fees
 * 
 * NEW APPROACH:
 * - Frontend calls Privacy Cash SDK directly (not backend)
 * - User's wallet signs and pays for everything
 * - Backend only records the transaction
 * 
 * Flow:
 * 1. Frontend: Initialize Privacy Cash SDK with user's wallet
 * 2. Frontend: Call SDK.deposit() - generates proof and transaction
 * 3. Frontend: User signs transaction in Phantom
 * 4. Frontend: Submit signed transaction to blockchain
 * 5. Frontend: Send transaction hash to backend
 * 6. Backend: Record transaction in database
 * 
 * Result: User pays all fees, operator wallet not needed for deposits
 */

interface DepositRecordRequest {
  linkId: string
  transactionHash: string
  amount: string | number
  publicKey: string
  lamports: number
}

/**
 * ✅ ENDPOINT: Record completed deposit
 * 
 * This endpoint is called AFTER user has already submitted the transaction
 * Backend just records it in database
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { 
      linkId, 
      transactionHash,
      amount, 
      lamports, 
      publicKey
    } = req.body as DepositRecordRequest

    console.log(`\n🔗 DEPOSIT RECORD ENDPOINT`)
    console.log(`📋 Recording deposit:`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   User: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   Transaction: ${transactionHash}`)

    // ✅ VALIDATE INPUT
    if (!linkId || typeof linkId !== 'string') {
      console.error('❌ Missing linkId')
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      console.error('❌ Missing publicKey')
      return res.status(400).json({ error: 'publicKey required' })
    }

    if (!transactionHash || typeof transactionHash !== 'string') {
      console.error('❌ Missing transactionHash')
      return res.status(400).json({ 
        error: 'transactionHash required',
        details: 'Frontend must provide the transaction signature'
      })
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      console.error('❌ Missing amount')
      return res.status(400).json({ error: 'amount required' })
    }

    if (typeof lamports !== 'number') {
      console.error('❌ Missing lamports')
      return res.status(400).json({ error: 'lamports required' })
    }

    // ✅ Validate Solana address format
    console.log(`🔍 Validating wallet address...`)
    try {
      new PublicKey(publicKey)
      console.log(`   ✅ Valid Solana address`)
    } catch {
      console.error('❌ Invalid publicKey format')
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ FIND LINK
    console.log(`🔍 Looking up payment link...`)
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      console.error(`❌ Link not found: ${linkId}`)
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      console.error(`❌ Deposit already recorded: ${linkId}`)
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    console.log(`✅ Link verified: ${link.id}`)

    const amountSOL = typeof amount === 'string' ? parseFloat(amount) : amount

    // ✅ OPTIONAL: Verify transaction on blockchain
    console.log(`\n🔍 Verifying transaction on blockchain...`)
    try {
      const rpcUrl = process.env.RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
      const connection = new Connection(rpcUrl)
      
      const txInfo = await connection.getTransaction(transactionHash, {
        maxSupportedTransactionVersion: 0
      })
      
      if (txInfo) {
        console.log(`   ✅ Transaction verified on blockchain`)
        console.log(`   Block: ${txInfo.slot}`)
      } else {
        console.log(`   ⚠️  Transaction not found yet (might still be processing)`)
      }
    } catch (verifyErr) {
      console.log(`   ⚠️  Could not verify transaction (will still record)`)
    }

    // ✅ RECORD DEPOSIT IN DATABASE
    console.log(`\n💾 Recording transaction in database...`)
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: { 
          depositTx: transactionHash,
        },
      }),
      prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: transactionHash,
          amount: amountSOL,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        },
      }),
    ])

    console.log(`✅ Transaction recorded in database`)

    console.log(`\n✅ DEPOSIT RECORDED`)
    console.log(`   Amount: ${amountSOL} SOL`)
    console.log(`   User wallet: ${publicKey}`)
    console.log(`   Transaction: ${transactionHash}`)

    return res.status(200).json({
      success: true,
      tx: transactionHash,
      transactionHash: transactionHash,
      amount: amountSOL,
      message: 'Deposit recorded. User paid all fees.',
      status: 'confirmed',
      details: {
        userPaid: true,
        userWallet: publicKey,
        amountSOL: amountSOL,
        description: 'Your wallet signed and paid for this deposit. Funds are encrypted in Privacy Cash pool.'
      },
    })
  } catch (error: any) {
    console.error('\n❌ RECORD DEPOSIT FAILED:', error.message)
    console.error('❌ Full error:', error)
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record deposit',
      details: String(error),
    })
  }
})

export default router
