import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'

const router = Router()

/**
 * ✅ RELAY SIGNED TRANSACTION TO PRIVACY CASH RELAYER
 * 
 * Frontend uses Privacy Cash SDK to:
 * 1. Generate ZK proof
 * 2. Create encrypted UTXOs
 * 3. Sign transaction
 * 
 * Backend relays signed transaction to Privacy Cash relayer API
 * which then submits to Solana
 */
async function relayToPrivacyCash(payload: {
  linkId: string
  signedTransaction: string
  amount: number
  publicKey: string
  referrer?: string
}): Promise<{ transactionHash: string }> {
  console.log(`🔗 Relaying signed transaction to Privacy Cash relayer...`)
  
  // Privacy Cash Relayer API endpoint
  const RELAYER_API_URL = process.env.PRIVACY_CASH_RELAYER_URL || 'https://relayer.privacycash.org'
  
  try {
    // Call Privacy Cash relayer with signed transaction
    const response = await fetch(`${RELAYER_API_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signedTransaction: payload.signedTransaction,
        senderAddress: payload.publicKey,
        referralWalletAddress: payload.referrer,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Privacy Cash Relayer Error (${response.status}):`, errorText)
      
      throw new Error(
        `Privacy Cash relayer error (${response.status}): ${errorText || response.statusText}`
      )
    }

    const result = await response.json() as { signature?: string; success?: boolean; [key: string]: any }

    if (!result.signature) {
      throw new Error('Privacy Cash relayer did not return transaction signature')
    }

    console.log(`✅ Privacy Cash relayer accepted transaction`)
    console.log(`   Signature: ${result.signature}`)
    
    return {
      transactionHash: result.signature,
    }
  } catch (error: any) {
    // Fallback to mock for development
    if (process.env.ALLOW_MOCK_DEPOSITS === 'true') {
      console.warn('⚠️  ALLOW_MOCK_DEPOSITS=true: Generating mock transaction signature')
      return {
        transactionHash: 'dev_' + crypto.randomBytes(16).toString('hex'),
      }
    }
    
    console.error('❌ Privacy Cash Relayer Error:', error.message)
    throw new Error(`Failed to relay transaction to Privacy Cash: ${error.message}`)
  }
}

/**
 * POST /api/deposit
 *
 * ✅ PRIVACY CASH SDK DEPOSIT RELAY:
 * Frontend (using Privacy Cash SDK) sends:
 * 1. Signed transaction (already has ZK proof, encrypted UTXO, etc)
 * 2. User's public key
 * 3. Link ID
 * 
 * Backend relays signed transaction to Privacy Cash relayer API
 * which submits to Solana and Privacy Cash pool
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, signedTransaction, amount, publicKey, referrer } = req.body

    // ✅ VALIDATE INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!signedTransaction || typeof signedTransaction !== 'string') {
      return res.status(400).json({ 
        error: 'signedTransaction required',
        details: 'Frontend must sign transaction with Privacy Cash SDK before sending to backend'
      })
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

    console.log(`📨 Received signed transaction for link ${linkId}...`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Sender: ${publicKey}`)
    console.log(`   Transaction signed by Privacy Cash SDK`)

    // ✅ RELAY SIGNED TRANSACTION TO PRIVACY CASH RELAYER
    console.log(`🔄 Relaying to Privacy Cash relayer...`)
    
    let privacyCashTx: string
    try {
      const relayResponse = await relayToPrivacyCash({
        linkId,
        signedTransaction,
        amount: typeof amount === 'string' ? parseFloat(amount) : amount,
        publicKey,
        referrer,
      })
      
      privacyCashTx = relayResponse.transactionHash
      
      console.log(`✅ Relayed to Privacy Cash`)
      console.log(`   Signature: ${privacyCashTx}`)
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
    console.log(`   Status: Relayed to Privacy Cash pool`)

    return res.status(200).json({
      success: true,
      tx: privacyCashTx,
      transactionHash: privacyCashTx,
      amount,
      message: 'Deposit successful. Transaction relayed to Privacy Cash pool.',
      status: 'relayed',
      details: {
        encrypted: true,
        zkProof: true,
        relayerSubmitted: true,
        description: 'Your transaction is encrypted and submitted via Privacy Cash relayer.'
      },
    })
  } catch (error: any) {
    console.error('❌ Deposit error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process deposit',
    })
  }
})

export default router

