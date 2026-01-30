/**
 * ✅ MINIMAL BACKEND ROUTES
 * 
 * POST /api/links - Save created link
 * GET /api/links/:id - Get link status
 * POST /api/links/:id/claim - Mark as claimed
 */

import { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import {
  createLinkRecord,
  getLinkRecord,
  markLinkClaimed,
  getAllLinks,
} from '../services/linkService.js'

const router = Router()

/**
 * POST /api/links
 * Save link after frontend deposits to Privacy Cash
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, amount, creatorAddress } = req.body

    // Validate
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'linkId required' })
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' })
    }

    console.log(`\n📥 POST /api/links`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   Amount: ${amount} SOL`)

    // Save to database
    await createLinkRecord({
      linkId,
      amount,
      creatorAddress,
    })

    return res.status(201).json({
      success: true,
      linkId,
      amount,
      status: 'active',
    })
  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to create link',
      details: error.message,
    })
  }
})

/**
 * GET /api/links/:id
 * Get link details
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params

    console.log(`📥 GET /api/links/${id}`)

    const link = await getLinkRecord(id)

    if (!link) {
      console.log(`   ❌ Not found`)
      return res.status(404).json({ error: 'Link not found' })
    }

    console.log(`   ✅ Found: ${link.amount} SOL, Status: ${link.status}`)

    return res.json(link)
  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to get link',
      details: error.message,
    })
  }
})

/**
 * POST /api/links/:id/claim
 * Mark link as claimed (after frontend successfully withdrew)
 */
router.post('/:id/claim', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params
    const { claimedBy, withdrawTx } = req.body

    if (!claimedBy || typeof claimedBy !== 'string') {
      return res.status(400).json({ error: 'claimedBy required' })
    }

    if (!withdrawTx || typeof withdrawTx !== 'string') {
      return res.status(400).json({ error: 'withdrawTx required' })
    }

    console.log(`\n📥 POST /api/links/${id}/claim`)
    console.log(`   Claimed by: ${claimedBy}`)
    console.log(`   TX: ${withdrawTx}`)

    const link = await getLinkRecord(id)

    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }

    if (link.status === 'claimed') {
      console.log(`   ⚠️  Already claimed`)
      return res.status(400).json({ error: 'Link already claimed' })
    }

    // Mark as claimed
    const updatedLink = await markLinkClaimed({
      linkId: id,
      claimedBy,
      withdrawTx,
    })

    return res.json({
      success: true,
      ...updatedLink,
    })
  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to claim link',
      details: error.message,
    })
  }
})

/**
 * GET /api/links
 * Get all links (admin/debugging only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log(`📥 GET /api/links`)

    const links = await getAllLinks()

    console.log(`   ✅ Found ${links.length} links`)

    return res.json({
      count: links.length,
      links,
    })
  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    return res.status(500).json({
      error: 'Failed to get links',
      details: error.message,
    })
  }
})

export default router
