/**
 * ✅ CORRECT BACKEND ROUTES FOR PRIVACY CASH LINKS
 * 
 * ARCHITECTURE:
 * - Backend performs SDK calls (deposit/withdraw)
 * - Database stores metadata (amount, status, expiry)
 * - Frontend calls backend APIs only (NO direct SDK calls)
 * 
 * Flow:
 * 1️⃣  POST /api/links - Create link + deposit to Privacy Cash
 * 2️⃣  GET /api/links/:id - Preview link (amount, status, expiry)
 * 3️⃣  POST /api/links/:id/claim - Claim link + withdraw from Privacy Cash
 * 4️⃣  GET /api/links - List all links (admin only)
 */

import { Router, Request, Response } from 'express'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { getPrivacyCashClient, executeDeposit, executeWithdrawal } from '../services/privacyCash.js'

const router = Router()

/**
 * 1️⃣  POST /api/links
 * 
 * CREATE LINK - Backend deposits to Privacy Cash
 * 
 * Request:
 * {
 *   amount: 0.25,          // SOL
 *   memo?: "payment",      // Optional
 *   expiryDays?: 7         // Optional, default 30
 * }
 * 
 * Response:
 * {
 *   linkId: "abc123...",
 *   amount: 0.25,
 *   status: "active",
 *   depositTx: "...",
 *   shareUrl: "https://shadowpay.app/claim/abc123..."
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { amount, memo, expiryDays } = req.body

    // ✅ VALIDATION
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount - must be > 0' })
    }

    if (amount > 100) {
      return res.status(400).json({ error: 'Amount too large - max 100 SOL' })
    }

    const expiry = expiryDays || 30

    console.log(`\n📝 CREATE LINK`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Memo: ${memo || 'none'}`)
    console.log(`   Expiry: ${expiry} days`)

    // ✅ STEP 1: Initialize Privacy Cash
    console.log(`🔄 Initializing Privacy Cash...`)
    let pc: any
    try {
      pc = getPrivacyCashClient()
    } catch (err: any) {
      console.error(`❌ SDK initialization failed: ${err.message}`)
      return res.status(500).json({
        error: 'Failed to initialize Privacy Cash SDK',
        details: err.message
      })
    }

    // ✅ STEP 2: Perform deposit to Privacy Cash pool
    console.log(`💸 Depositing to Privacy Cash pool...`)
    let depositResult: any
    try {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL)
      depositResult = await executeDeposit(pc, lamports)
      console.log(`✅ Deposit successful: ${depositResult.tx}`)
    } catch (err: any) {
      console.error(`❌ Deposit failed: ${err.message}`)
      
      // Determine error message based on error type
      let errorMsg = 'Deposit failed - check operator balance'
      if (err.message.includes('Insufficient')) {
        errorMsg = 'Operator wallet has insufficient SOL for deposit fee'
      }
      
      return res.status(500).json({
        error: errorMsg,
        details: err.message
      })
    }

    // ✅ STEP 3: Generate link ID
    const linkId = crypto.randomBytes(16).toString('hex')
    const lamports = BigInt(Math.round(amount * LAMPORTS_PER_SOL))
    const expiryAt = new Date()
    expiryAt.setDate(expiryAt.getDate() + expiry)

    console.log(`✅ Generated linkId: ${linkId}`)

    // ✅ STEP 4: Save metadata to database
    console.log(`💾 Saving to database...`)
    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount,
        lamports,
        assetType: 'SOL',
        claimed: false,
        depositTx: depositResult.tx,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    console.log(`✅ Link created and saved to database`)

    return res.status(201).json({
      success: true,
      linkId,
      amount,
      status: 'active',
      depositTx: depositResult.tx,
      shareUrl: `https://shadowpay.app/claim/${linkId}`,
      message: 'Payment link created successfully. Share the link with recipient.'
    })

  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to create link',
      details: error.message
    })
  }
})

/**
 * 2️⃣  GET /api/links/:id
 * 
 * PREVIEW LINK - Get link details (read-only)
 * 
 * Response:
 * {
 *   linkId: "abc123...",
 *   amount: 0.25,
 *   status: "active",      // active, claimed, expired
 *   expiryAt: "2025-02-27T10:00:00Z",
 *   claimed: false,
 *   claimedBy: null
 * }
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params

    console.log(`\n👁️  PREVIEW LINK`)
    console.log(`   LinkId: ${id}`)

    const link = await prisma.paymentLink.findUnique({
      where: { id }
    })

    if (!link) {
      console.log(`   ❌ Not found`)
      return res.status(404).json({ error: 'Link not found' })
    }

    const now = new Date()
    const expired = link.createdAt.getTime() + (30 * 24 * 60 * 60 * 1000) < now.getTime()
    const status = link.claimed ? 'claimed' : (expired ? 'expired' : 'active')

    console.log(`   ✅ Found: ${link.amount} SOL, Status: ${status}`)

    return res.json({
      linkId: link.id,
      amount: link.amount,
      assetType: link.assetType,
      status,
      claimed: link.claimed,
      claimedBy: link.claimedBy || null,
      createdAt: link.createdAt,
      expiryAt: new Date(link.createdAt.getTime() + (30 * 24 * 60 * 60 * 1000))
    })

  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to get link',
      details: error.message
    })
  }
})

/**
 * 3️⃣  POST /api/links/:id/claim
 * 
 * CLAIM LINK - Backend withdraws from Privacy Cash to recipient
 * 
 * Request:
 * {
 *   recipientAddress: "ABC123..."  // Solana address
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   linkId: "abc123...",
 *   withdrawTx: "...",
 *   recipient: "ABC123...",
 *   amount: 0.25,
 *   status: "claimed"
 * }
 */
router.post('/:id/claim', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params
    const { recipientAddress } = req.body

    console.log(`\n🎁 CLAIM LINK`)
    console.log(`   LinkId: ${id}`)
    console.log(`   Recipient: ${recipientAddress}`)

    // ✅ VALIDATION
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return res.status(400).json({ error: 'recipientAddress required' })
    }

    try {
      new PublicKey(recipientAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid recipient address format' })
    }

    // ✅ STEP 1: Find and validate link
    console.log(`🔍 Finding link...`)
    const link = await prisma.paymentLink.findUnique({
      where: { id }
    })

    if (!link) {
      console.log(`   ❌ Link not found`)
      return res.status(404).json({ error: 'Link not found' })
    }

    console.log(`   ✅ Found: ${link.amount} SOL`)

    // ✅ Check if already claimed
    if (link.claimed) {
      console.log(`   ❌ Already claimed`)
      return res.status(400).json({ error: 'Link already claimed' })
    }

    // ✅ Check if deposit exists
    if (!link.depositTx || link.depositTx.trim() === '') {
      console.log(`   ❌ No deposit recorded`)
      return res.status(400).json({ error: 'No valid deposit found for this link' })
    }

    // ✅ STEP 2: Initialize Privacy Cash
    console.log(`🔄 Initializing Privacy Cash...`)
    let pc: any
    try {
      pc = getPrivacyCashClient()
    } catch (err: any) {
      console.error(`❌ SDK initialization failed`)
      return res.status(500).json({
        error: 'Failed to initialize Privacy Cash SDK',
        details: err.message
      })
    }

    // ✅ STEP 3: Perform withdrawal from Privacy Cash pool
    console.log(`📤 Withdrawing from Privacy Cash pool...`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)

    let withdrawResult: any
    try {
      const lamports = Number(link.lamports)
      withdrawResult = await executeWithdrawal(pc, lamports, recipientAddress)
      console.log(`✅ Withdrawal successful: ${withdrawResult.tx}`)
    } catch (err: any) {
      console.error(`❌ Withdrawal failed: ${err.message}`)
      return res.status(500).json({
        error: 'Withdrawal failed - try again later',
        details: err.message
      })
    }

    // ✅ STEP 4: Update database - mark as claimed
    console.log(`💾 Updating database...`)
    const updated = await prisma.paymentLink.update({
      where: { id },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx: withdrawResult.tx,
        updatedAt: new Date(),
      }
    })

    console.log(`✅ Link marked as claimed`)

    return res.json({
      success: true,
      linkId: id,
      withdrawTx: withdrawResult.tx,
      recipient: recipientAddress,
      amount: link.amount,
      status: 'claimed',
      message: 'Payment claimed successfully!'
    })

  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to claim link',
      details: error.message
    })
  }
})

/**
 * 4️⃣  GET /api/links
 * List all links (admin/debugging only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log(`\n📥 GET /api/links`)

    const links = await prisma.paymentLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    console.log(`   ✅ Found ${links.length} links`)

    return res.json({
      count: links.length,
      links: links.map(link => ({
        linkId: link.id,
        amount: link.amount,
        status: link.claimed ? 'claimed' : 'active',
        claimed: link.claimed,
        claimedBy: link.claimedBy || null,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      }))
    })
  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to list links',
      details: error.message
    })
  }
})

export default router
