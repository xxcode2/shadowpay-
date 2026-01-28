import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'

const router = Router()

/**
 * POST /api/deposit
 *
 * ✅ PRIVACY CASH SDK DEPOSIT RELAY:
 * 1. Frontend: User signs encrypted UTXO data
 * 2. Frontend: Send UTXO + signature to backend
 * 3. Backend: Relay to Privacy Cash API/indexer
 * 4. Backend: Record transaction hash in database
 * 
 * Key:
 * - Funds are encrypted client-side with user's key
 * - Backend only relays to Privacy Cash (no direct custody)
 * - Privacy Cash handles pool and privacy operations
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, utxo, signature, amount, publicKey } = req.body

    // ✅ VALIDASI INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!utxo || typeof utxo !== 'object') {
      return res.status(400).json({ error: 'utxo (encrypted UTXO data) required' })
    }

    if (!signature || !Array.isArray(signature)) {
      return res.status(400).json({ error: 'signature (user signature) required' })
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

    // ✅ VALIDATE UTXO STRUCTURE
    if (!utxo.amount || !utxo.blinding || !utxo.pubkey || !utxo.mintAddress) {
      return res.status(400).json({ error: 'Invalid UTXO structure' })
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

    console.log(`📨 Receiving encrypted UTXO for link ${linkId}...`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Sender: ${publicKey}`)
    console.log(`   Privacy: Encrypted with user's key`)

    // ✅ RELAY TO PRIVACY CASH
    // In production, this would call Privacy Cash indexer API
    console.log(`🔄 Relaying to Privacy Cash...`)
    
    let privacyCashTx: string
    try {
      // TODO: Implement actual Privacy Cash API endpoint call
      // For now, require a mock flag to be explicitly set
      // This ensures users don't accidentally use fake deposits
      if (process.env.ALLOW_MOCK_DEPOSITS === 'true') {
        // DANGER: Mock mode only for development/testing
        console.warn('⚠️  WARNING: Using mock deposits! This is for development only.')
        privacyCashTx = 'PrivacyCash_' + Buffer.from(signature).toString('hex').slice(0, 44)
      } else {
        // Production mode: require real Privacy Cash integration
        throw new Error(
          'Privacy Cash API integration required. ' +
          'UTXO relaying to Privacy Cash pool is not yet implemented. ' +
          'Please implement the actual Privacy Cash API call at https://api.privacycash.org/deposit'
        )
      }
      
      console.log(`✅ Relayed to Privacy Cash`)
      console.log(`   Privacy Cash TX: ${privacyCashTx}`)
    } catch (relayErr: any) {
      console.error('❌ Failed to relay to Privacy Cash:', relayErr.message)
      return res.status(502).json({
        error: 'Failed to relay to Privacy Cash',
        details: relayErr.message,
      })
    }

    // ✅ RECORD DEPOSIT IN DATABASE
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: { 
          depositTx: privacyCashTx,
        },
      }),
      prisma.transaction.create({
        data: {
          type: 'deposit',
          linkId,
          transactionHash: privacyCashTx,
          amount: typeof amount === 'string' ? parseFloat(amount) : amount,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        },
      }),
    ])

    console.log(`✅ Deposit recorded in database`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Status: In Privacy Cash pool`)

    return res.status(200).json({
      success: true,
      tx: privacyCashTx,
      transactionHash: privacyCashTx,
      amount,
      message: 'Deposit successful. Funds are now in Privacy Cash shielded pool.',
      status: 'in_privacy_pool',
      privacy: {
        encrypted: true,
        only_user_can_claim: true,
        description: 'Your funds are encrypted with your private key. Only you can claim them.'
      },
    })
  } catch (err: any) {
    console.error('❌ Deposit error:', err)

    return res.status(500).json({
      error: 'Failed to process deposit',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

export default router

