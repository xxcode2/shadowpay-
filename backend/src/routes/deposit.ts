import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * ✅ CORRECT ARCHITECTURE DENGAN PRIVACY CASH SDK:
 * 1. Frontend: User sign offchain message ("Privacy Money account sign in")
 * 2. Frontend: SDK handle encryption dan deposit ke Privacy Cash pool
 * 3. Frontend: Send transaction hash ke backend
 * 4. Backend: Verifikasi dan record transaction hash di database
 * 
 * Key difference:
 * - Frontend NOW executes deposit (SDK handles everything)
 * - Backend ONLY records the transaction hash (no execution needed)
 * - User funds go DIRECTLY to Privacy Cash shielded pool
 * - SDK handles encryption client-side
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx, amount, publicKey } = req.body

    // ✅ VALIDASI INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx (transaction hash) required' })
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount required (as string or number)' })
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
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    console.log(`📝 Recording deposit for link ${linkId}...`)
    console.log(`   Transaction: ${depositTx}`)
    console.log(`   Sender: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ RECORD DEPOSIT IN DATABASE
    // Frontend sudah execute deposit via Privacy Cash SDK
    // Backend hanya record transaction hash
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
          amount: typeof amount === 'string' ? parseFloat(amount) : amount,
          assetType: link.assetType,
          status: 'confirmed', // SDK executes, so we assume confirmed
          fromAddress: publicKey,
        },
      }),
    ])

    console.log(`✅ Deposit RECORDED successfully`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Transaction: ${depositTx}`)

    return res.status(200).json({
      success: true,
      tx: depositTx,
      amount,
      message: 'Deposit recorded successfully. Funds are now in Privacy Cash shielded pool.',
      fee: {
        depositFee: 0,
        note: 'Withdrawal fees (0.006 SOL + 0.35%) will be charged when recipient claims',
      },
    })
  } catch (err: any) {
    console.error('❌ Deposit recording error:', err)

    return res.status(500).json({
      error: 'Failed to record deposit',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

/**
 * POST /api/deposit/execute
 * 
 * Backend executes deposit via Privacy Cash SDK using operator keypair
 * **IMPORTANT**: This charges the OPERATOR wallet, not the user!
 * Only use this endpoint for admin/test deposits.
 * 
 * For user deposits, use /api/deposit/build-instruction instead
 * so that users pay from their own wallets.
 */
router.post('/execute', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, amount, lamports, publicKey } = req.body

    // ✅ VALIDASI INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey required' })
    }

    if (!lamports || typeof lamports !== 'number') {
      return res.status(400).json({ error: 'lamports required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(publicKey)
    } catch {
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    console.log(`📝 Executing deposit for link ${linkId}...`)
    console.log(`   User: ${publicKey}`)
    console.log(`   Amount: ${lamports} lamports (${amount} SOL)`)
    console.log(`   ⚠️  WARNING: This uses OPERATOR keypair (operator pays)`)

    // ✅ EXECUTE DEPOSIT VIA PRIVACY CASH SDK WITH OPERATOR KEYPAIR
    const { getPrivacyCashClient } = await import('../services/privacyCash.js')
    
    try {
      const pc = getPrivacyCashClient()
      
      console.log(`📤 Executing deposit via Privacy Cash SDK...`)
      console.log(`   🔐 Using operator keypair to deposit`)
      
      // Check balance before
      const balanceBefore = await pc.getPrivateBalance()
      const balanceBeforeLamports = typeof balanceBefore === 'object' ? balanceBefore.lamports : balanceBefore
      console.log(`   Balance before: ${balanceBeforeLamports} lamports`)
      
      // ✅ Call SDK deposit() - this will:
      // - Generate ZK proof
      // - Create proper deposit transaction
      // - Relay to Privacy Cash indexer
      // - Update private balance
      const depositResult = await pc.deposit({
        lamports: lamports
      })
      
      const depositTx = depositResult.tx
      
      console.log(`✅ Deposit executed successfully!`)
      console.log(`   Transaction: ${depositTx}`)
      
      // Check balance after
      const balanceAfter = await pc.getPrivateBalance()
      const balanceAfterLamports = typeof balanceAfter === 'object' ? balanceAfter.lamports : balanceAfter
      console.log(`   Balance after: ${balanceAfterLamports} lamports`)
      console.log(`   Balance increased: ${balanceAfterLamports - balanceBeforeLamports} lamports`)
      
      // ✅ RECORD DEPOSIT IN DATABASE
      console.log(`📤 Recording deposit in database...`)
      
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
            amount: typeof amount === 'string' ? parseFloat(amount) : amount,
            assetType: link.assetType,
            status: 'confirmed',
            fromAddress: publicKey,
          },
        }),
      ])
      
      console.log(`✅ Deposit recorded in database`)
      
      return res.status(200).json({
        success: true,
        tx: depositTx,
        amount,
        message: 'Deposit executed and recorded successfully. Funds are now in your Privacy Cash private balance.',
      })
    } catch (sdkErr: any) {
      console.error('❌ Privacy Cash SDK error:', sdkErr.message)
      
      // Check if it's an insufficient balance error
      if (sdkErr.message?.includes('Insufficient balance')) {
        return res.status(400).json({
          error: 'Operator wallet has insufficient SOL balance for deposit',
          details: process.env.NODE_ENV === 'development' ? sdkErr.message : undefined,
        })
      }
      
      return res.status(500).json({
        error: 'Failed to execute deposit via Privacy Cash SDK',
        details: process.env.NODE_ENV === 'development' ? sdkErr.message : undefined,
      })
    }
  } catch (err: any) {
    console.error('❌ Deposit execution error:', err)

    return res.status(500).json({
      error: 'Failed to execute deposit',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

/**
 * POST /api/deposit/relay
 * 
 * ✅ USER-CENTRIC DEPOSIT FLOW (Fully Non-Custodial):
 * 1. Frontend: User sign off-chain message for encryption key
 * 2. Frontend: SDK creates UTXO with amount + blinding + pubkey
 * 3. Frontend: User signs UTXO with wallet
 * 4. Frontend: Send UTXO + signature to backend
 * 5. Backend: Record UTXO data in database
 * 6. Backend: Return confirmation to frontend
 * 
 * Backend records UTXO for later withdrawal verification
 * Funds are already deposited via user signature, not relayed
 */
router.post('/relay', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { utxo, signature, senderAddress, linkId } = req.body

    // ✅ VALIDASI INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!utxo || typeof utxo !== 'object') {
      return res.status(400).json({ error: 'utxo (UTXO data) required' })
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'signature (UTXO signature) required' })
    }

    if (!senderAddress || typeof senderAddress !== 'string') {
      return res.status(400).json({ error: 'senderAddress required' })
    }

    // ✅ Validate Solana address format
    try {
      new PublicKey(senderAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid senderAddress format' })
    }

    // ✅ FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    const amount = parseFloat(utxo.amount) / 1_000_000_000 // Convert lamports to SOL

    console.log(`📥 Received deposit relay for link ${linkId}...`)
    console.log(`   Sender: ${senderAddress}`)
    console.log(`   Amount: ${amount} SOL (${utxo.amount} lamports)`)
    console.log(`   UTXO: amount=${utxo.amount}, blinding=${utxo.blinding}, pubkey=${utxo.pubkey}`)

    try {
      // ✅ RECORD DEPOSIT IN DATABASE
      console.log(`💾 Recording deposit in database...`)

      const txHash = `utxo_${linkId}_${Date.now()}`  // Generate unique transaction ID

      await prisma.$transaction([
        prisma.paymentLink.update({
          where: { id: linkId },
          data: { depositTx: txHash },
        }),
        prisma.transaction.create({
          data: {
            type: 'deposit',
            linkId,
            transactionHash: txHash,
            amount,
            assetType: link.assetType,
            status: 'confirmed',
            fromAddress: senderAddress,
          },
        }),
      ])

      console.log(`✅ UTXO recorded successfully!`)
      console.log(`   Transaction ID: ${txHash}`)
      console.log(`   Amount: ${amount} SOL`)

      return res.status(200).json({
        success: true,
        tx: txHash,
        message: 'Deposit recorded successfully. Funds are in Privacy Cash pool.',
        details: {
          linkId,
          amount,
          senderAddress,
          utxoHash: utxo.pubkey,
        },
      })
    } catch (dbErr: any) {
      console.error('❌ Database error:', dbErr.message)

      return res.status(500).json({
        error: 'Failed to record deposit',
        details: process.env.NODE_ENV === 'development' ? dbErr.message : 'Database error',
      })
    }
  } catch (err: any) {
    console.error('❌ Deposit relay error:', err)

    return res.status(500).json({
      error: 'Failed to process deposit relay',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

/**
 * POST /api/deposit/record
 * 
 * Record a user-signed deposit transaction in the database
 */
router.post('/record', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, depositTx, amount, publicKey } = req.body

    // ✅ VALIDASI INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx (transaction hash) required' })
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount required' })
    }

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey required' })
    }

    // ✅ Validate Solana address
    try {
      new PublicKey(publicKey)
    } catch {
      return res.status(400).json({ error: 'Invalid publicKey format' })
    }

    // ✅ FIND LINK
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.depositTx && link.depositTx !== '') {
      return res.status(400).json({ error: 'Deposit already recorded for this link' })
    }

    console.log(`📝 Recording user deposit for link ${linkId}...`)
    console.log(`   Transaction: ${depositTx}`)
    console.log(`   Sender: ${publicKey}`)
    console.log(`   Amount: ${amount} SOL`)

    // ✅ RECORD DEPOSIT IN DATABASE
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
          amount: typeof amount === 'string' ? parseFloat(amount) : amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        },
      }),
    ])

    console.log(`✅ User deposit recorded successfully`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Transaction: ${depositTx}`)

    return res.status(200).json({
      success: true,
      tx: depositTx,
      amount,
      message: 'Deposit recorded successfully. Funds are now in your Privacy Cash shielded pool.',
    })
  } catch (err: any) {
    console.error('❌ Deposit recording error:', err)

    return res.status(500).json({
      error: 'Failed to record deposit',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

export default router
    

