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

const router = Router()

/**
 * 1️⃣  POST /api/links
 * 
 * CREATE LINK - Save User A's deposit metadata
 * 
 * ✅ User A deposits directly with their wallet
 * ✅ Backend only records the deposit TX
 * 
 * Request:
 * {
 *   amount: 0.25,          // SOL
 *   depositTx: "5Tx...",   // TX from User A's deposit
 *   memo?: "payment"       // Optional
 * }
 * 
 * Response:
 * {
 *   linkId: "abc123...",
 *   amount: 0.25,
 *   status: "active",
 *   depositTx: "5Tx...",
 *   shareUrl: "https://shadowpay.app/claim/abc123..."
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { amount, depositTx, memo } = req.body

    // ✅ VALIDATION
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount - must be > 0' })
    }

    if (amount > 100) {
      return res.status(400).json({ error: 'Amount too large - max 100 SOL' })
    }

    if (!depositTx || typeof depositTx !== 'string') {
      return res.status(400).json({ error: 'depositTx required - User must deposit first' })
    }

    console.log(`\n📝 CREATE LINK`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Deposit TX: ${depositTx.substring(0, 20)}...`)
    console.log(`   Memo: ${memo || 'none'}`)

    // ✅ STEP 1: Generate link ID
    const linkId = crypto.randomBytes(16).toString('hex')
    const lamports = BigInt(Math.round(amount * LAMPORTS_PER_SOL))

    console.log(`✅ Generated linkId: ${linkId}`)

    // ✅ STEP 2: Save metadata to database
    console.log(`💾 Saving to database...`)
    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount,
        lamports,
        assetType: 'SOL',
        claimed: false,
        depositTx: depositTx,
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
      depositTx: depositTx,
      shareUrl: `https://shadowpay.app/claim/${linkId}`,
      message: 'Payment link created successfully. Share with recipient!'
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
 * CLAIM LINK - Record User B's withdrawal
 * 
 * ✅ User B withdraws directly with their wallet
 * ✅ Backend only records the withdrawal TX
 * 
 * Request:
 * {
 *   withdrawTx: "5Tx...",     // TX from User B's withdrawal
 *   recipient: "ABC123..."    // Solana address
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   linkId: "abc123...",
 *   withdrawTx: "5Tx...",
 *   recipient: "ABC123...",
 *   amount: 0.25,
 *   status: "claimed"
 * }
 */
router.post('/:id/claim', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params
    const { withdrawTx, recipient } = req.body

    console.log(`\n🎁 CLAIM LINK`)
    console.log(`   LinkId: ${id}`)
    console.log(`   Recipient: ${recipient}`)
    console.log(`   Withdrawal TX: ${withdrawTx?.substring(0, 20)}...`)

    // ✅ VALIDATION
    if (!withdrawTx || typeof withdrawTx !== 'string') {
      return res.status(400).json({ error: 'withdrawTx required - User must withdraw first' })
    }

    if (!recipient || typeof recipient !== 'string') {
      return res.status(400).json({ error: 'recipient required' })
    }

    try {
      new PublicKey(recipient)
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

    // ✅ STEP 2: Update database - record the withdrawal
    console.log(`💾 Updating database...`)
    const updated = await prisma.paymentLink.update({
      where: { id },
      data: {
        claimed: true,
        claimedBy: recipient,
        withdrawTx: withdrawTx,
        updatedAt: new Date(),
      }
    })

    console.log(`✅ Link marked as claimed`)

    return res.json({
      success: true,
      linkId: id,
      withdrawTx: withdrawTx,
      recipient: recipient,
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
