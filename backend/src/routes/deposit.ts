import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'

const router = Router()

/**
 * ✅ REAL PRIVACY CASH API RELAY
 * 
 * Relays encrypted UTXOs to Privacy Cash pool
 * This is the real integration - not mocking
 */
async function relayToPrivacyCash(payload: {
  linkId: string
  utxo: any
  signature: number[]
  amount: number
  publicKey: string
}): Promise<{ transactionHash: string }> {
  console.log(`🔗 Calling Privacy Cash API...`)
  
  // Privacy Cash API endpoint
  const PRIVACY_CASH_API = process.env.PRIVACY_CASH_API_URL || 'https://api.privacycash.org/deposit'
  const API_KEY = process.env.PRIVACY_CASH_API_KEY
  
  // Check if we have API credentials
  if (!API_KEY) {
    // Allow fallback to mock for development only
    if (process.env.ALLOW_MOCK_DEPOSITS === 'true') {
      console.warn('⚠️  ALLOW_MOCK_DEPOSITS=true: Generating mock Privacy Cash TX')
      return {
        transactionHash: 'PrivacyCash_dev_' + crypto.randomBytes(16).toString('hex'),
      }
    }
    
    throw new Error(
      'PRIVACY_CASH_API_KEY environment variable not set. ' +
      'Cannot relay to Privacy Cash without credentials. ' +
      'For development only: Set ALLOW_MOCK_DEPOSITS=true'
    )
  }

  try {
    const response = await fetch(PRIVACY_CASH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-Link-ID': payload.linkId,
      },
      body: JSON.stringify({
        type: 'deposit',
        utxo: payload.utxo,
        signature: payload.signature,
        amount: payload.amount,
        publicKey: payload.publicKey,
        timestamp: Date.now(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Privacy Cash API Error (${response.status}):`, errorText)
      
      throw new Error(
        `Privacy Cash API error (${response.status}): ${errorText || response.statusText}`
      )
    }

    const result = await response.json() as { transactionHash?: string; [key: string]: any }

    if (!result.transactionHash) {
      throw new Error('Privacy Cash API did not return transaction hash')
    }

    console.log(`✅ Privacy Cash API accepted deposit`)
    console.log(`   Transaction Hash: ${result.transactionHash}`)
    
    return {
      transactionHash: result.transactionHash,
    }
  } catch (error: any) {
    console.error('❌ Privacy Cash API Error:', error.message)
    throw new Error(`Privacy Cash relay failed: ${error.message}`)
  }
}

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
    // This relays the encrypted UTXO to Privacy Cash pool
    console.log(`🔄 Relaying to Privacy Cash...`)
    
    let privacyCashTx: string
    try {
      // Relay encrypted UTXO to Privacy Cash pool
      const relayResponse = await relayToPrivacyCash({
        linkId,
        utxo,
        signature,
        amount: typeof amount === 'string' ? parseFloat(amount) : amount,
        publicKey,
      })
      
      privacyCashTx = relayResponse.transactionHash
      
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

