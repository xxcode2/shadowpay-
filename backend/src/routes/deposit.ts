import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import prisma from '../lib/prisma.js'
import crypto from 'crypto'
import { parseOperatorKeypair, initializePrivacyCash } from '../services/privacyCash.js'

const router = Router()

/**
 * ✅ DEPOSIT VIA PRIVACY CASH SDK (Backend)
 * 
 * Backend receives deposit request from frontend and:
 * 1. Initializes Privacy Cash SDK with operator keypair
 * 2. Calls SDK.deposit({ lamports })
 * 3. SDK generates ZK proof, encrypted UTXOs, and signs transaction
 * 4. Relays signed transaction to Privacy Cash relayer API
 * 5. Records transaction in database
 */
async function executePrivacyCashDeposit(payload: {
  linkId: string
  amount: number
  lamports: number
  publicKey: string
  referrer?: string
}): Promise<{ transactionHash: string }> {
  console.log(`🔐 Executing Privacy Cash SDK deposit...`)
  
  try {
    // Get operator keypair from environment
    if (!process.env.OPERATOR_SECRET_KEY) {
      throw new Error('OPERATOR_SECRET_KEY environment variable is required')
    }

    const operatorKeypair = parseOperatorKeypair(process.env.OPERATOR_SECRET_KEY)
    console.log(`   Operator: ${operatorKeypair.publicKey.toString()}`)

    // Initialize Privacy Cash SDK with operator keypair
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const privacyCashClient = initializePrivacyCash(operatorKeypair, rpcUrl, true)
    console.log(`   RPC: ${rpcUrl}`)

    // Call Privacy Cash SDK deposit
    console.log(`   📝 Calling Privacy Cash SDK deposit()...`)
    console.log(`      Amount: ${payload.lamports} lamports (${payload.amount} SOL)`)
    
    const depositResult = await privacyCashClient.deposit({
      lamports: payload.lamports,
    })

    const transactionHash = depositResult.tx
    if (!transactionHash) {
      throw new Error('Privacy Cash SDK did not return transaction hash')
    }

    console.log(`   ✅ Privacy Cash deposit executed`)
    console.log(`      Signature: ${transactionHash}`)
    console.log(`      Amount: ${payload.amount} SOL`)
    console.log(`      Status: Encrypted in Privacy Cash pool`)

    return { transactionHash }
  } catch (error: any) {
    // Fallback to mock for development
    if (process.env.ALLOW_MOCK_DEPOSITS === 'true') {
      console.warn('⚠️  ALLOW_MOCK_DEPOSITS=true: Generating mock transaction signature')
      return {
        transactionHash: 'dev_' + crypto.randomBytes(16).toString('hex'),
      }
    }
    
    console.error('❌ Privacy Cash SDK Error:', error.message)
    throw new Error(`Failed to execute Privacy Cash deposit: ${error.message}`)
  }
}

/**
 * POST /api/deposit
 *
 * ✅ PRIVACY CASH SDK DEPOSIT (Backend):
 * Frontend sends:
 * 1. User amount (SOL)
 * 2. User's public key
 * 3. Link ID
 * 
 * Backend:
 * 1. Initializes Privacy Cash SDK with operator keypair
 * 2. Calls SDK.deposit({ lamports })
 * 3. SDK handles all crypto (ZK proof, encryption, signing)
 * 4. Records transaction in database
 */
router.post('/', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { linkId, amount, lamports, publicKey, referrer, signature } = req.body

    // ✅ VALIDATE INPUT
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount required (as string or number)' })
    }

    if (typeof lamports !== 'number') {
      return res.status(400).json({ error: 'lamports required (as number)' })
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

    const amountSOL = typeof amount === 'string' ? parseFloat(amount) : amount

    console.log(`📨 Received deposit request for link ${linkId}...`)
    console.log(`   Amount: ${amountSOL} SOL (${lamports} lamports)`)
    console.log(`   User: ${publicKey}`)

    // ✅ EXECUTE PRIVACY CASH DEPOSIT VIA SDK
    console.log(`🔄 Executing deposit via Privacy Cash SDK...`)
    
    let privacyCashTx: string
    try {
      const depositResult = await executePrivacyCashDeposit({
        linkId,
        amount: amountSOL,
        lamports,
        publicKey,
        referrer,
      })
      
      privacyCashTx = depositResult.transactionHash
      
      console.log(`✅ Deposit executed via Privacy Cash SDK`)
      console.log(`   Signature: ${privacyCashTx}`)
    } catch (depositErr: any) {
      console.error('❌ Failed to execute Privacy Cash deposit:', depositErr.message)
      return res.status(502).json({
        error: 'Failed to execute Privacy Cash deposit',
        details: depositErr.message,
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
          amount: amountSOL,
          assetType: link.assetType,
          status: 'confirmed',
          fromAddress: publicKey,
        },
      }),
    ])

    console.log(`✅ Deposit recorded in database`)
    console.log(`   Link: ${linkId}`)
    console.log(`   Amount: ${amountSOL} SOL`)
    console.log(`   Status: Relayed to Privacy Cash pool`)

    return res.status(200).json({
      success: true,
      tx: privacyCashTx,
      transactionHash: privacyCashTx,
      amount: amountSOL,
      message: 'Deposit successful. Transaction encrypted in Privacy Cash pool.',
      status: 'confirmed',
      details: {
        encrypted: true,
        zkProof: true,
        privacyLevel: 'high',
        description: 'Your deposit is encrypted with zero-knowledge proofs in the Privacy Cash pool.'
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

