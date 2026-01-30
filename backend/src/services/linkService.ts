/**
 * ✅ MINIMAL BACKEND SERVICE
 * 
 * Backend doesn't handle crypto - just database operations
 * SDK (frontend) handle all Privacy Cash operations
 * 
 * Backend responsibility:
 * - Save linkId + metadata
 * - Retrieve link status
 * - Mark as claimed
 */

import prisma from '../lib/prisma.js'
import { PublicKey } from '@solana/web3.js'

export interface PaymentLinkInput {
  linkId: string
  amount: number
  creatorAddress?: string
}

export interface PaymentLinkResponse {
  linkId: string
  amount: number
  status: 'active' | 'claimed' | 'expired'
  claimedBy?: string
  withdrawTx?: string
  createdAt: string
}

/**
 * Create link record (after frontend deposits to Privacy Cash)
 */
export async function createLinkRecord(input: PaymentLinkInput): Promise<void> {
  console.log(`💾 Saving link to database:`)
  console.log(`   Link ID: ${input.linkId}`)
  console.log(`   Amount: ${input.amount} SOL\n`)

  try {
    await prisma.paymentLink.create({
      data: {
        id: input.linkId,
        amount: input.amount,
        lamports: Math.floor(input.amount * 1e9),
        assetType: 'SOL',
        claimed: false,
        claimedBy: null,
        withdrawTx: null,
      },
    })

    console.log(`✅ Link saved successfully\n`)
  } catch (error: any) {
    // Link might already exist
    if (error.code === 'P2002') {
      console.warn(`⚠️  Link already exists, updating...\n`)
      return
    }
    throw error
  }
}

/**
 * Get link details
 */
export async function getLinkRecord(linkId: string): Promise<PaymentLinkResponse | null> {
  const link = await prisma.paymentLink.findUnique({
    where: { id: linkId },
  })

  if (!link) {
    return null
  }

  return {
    linkId: link.id,
    amount: link.amount,
    status: link.claimed ? 'claimed' : 'active',
    claimedBy: link.claimedBy || undefined,
    withdrawTx: link.withdrawTx || undefined,
    createdAt: link.createdAt.toISOString(),
  }
}

/**
 * Mark link as claimed (called by backend after frontend withdraws)
 */
export async function markLinkClaimed(input: {
  linkId: string
  claimedBy: string
  withdrawTx: string
}): Promise<PaymentLinkResponse> {
  console.log(`📌 Marking link as claimed:`)
  console.log(`   Link ID: ${input.linkId}`)
  console.log(`   Claimed by: ${input.claimedBy}`)
  console.log(`   TX: ${input.withdrawTx}\n`)

  try {
    // Validate Solana address
    new PublicKey(input.claimedBy)
  } catch {
    throw new Error('Invalid Solana address')
  }

  const link = await prisma.paymentLink.update({
    where: { id: input.linkId },
    data: {
      claimed: true,
      claimedBy: input.claimedBy,
      withdrawTx: input.withdrawTx,
    },
  })

  console.log(`✅ Link marked as claimed\n`)

  return {
    linkId: link.id,
    amount: link.amount,
    status: 'claimed',
    claimedBy: link.claimedBy || undefined,
    withdrawTx: link.withdrawTx || undefined,
    createdAt: link.createdAt.toISOString(),
  }
}

/**
 * Get all links (for admin/debugging)
 */
export async function getAllLinks(): Promise<PaymentLinkResponse[]> {
  const links = await prisma.paymentLink.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return links.map(link => ({
    linkId: link.id,
    amount: link.amount,
    status: link.claimed ? 'claimed' : 'active',
    claimedBy: link.claimedBy || undefined,
    withdrawTx: link.withdrawTx || undefined,
    createdAt: link.createdAt.toISOString(),
  }))
}
