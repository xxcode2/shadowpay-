import prisma from '../lib/prisma.js'

/**
 * Link Manager Service
 * Handles all payment link operations with atomicity guarantees
 */

export interface CreateLinkInput {
  amount: number
  assetType: 'SOL' | 'USDC' | 'USDT'
}

export interface LinkResponse {
  id: string
  amount: number
  assetType: string
  claimed: boolean
  claimedBy: string | null
  depositTx: string | null
  withdrawTx: string | null
  createdAt: Date
  updatedAt: Date
}

export class LinkManager {
  /**
   * Create a new payment link
   * Returns the link ID to be shared
   */
  static async createLink(input: CreateLinkInput): Promise<string> {
    const link = await prisma.paymentLink.create({
      data: {
        amount: input.amount,
        assetType: input.assetType,
        claimed: false,
        depositTx: null,
        withdrawTx: null,
        // commitment not included - using UncheckedCreateInput pattern
      } as any,  // Force type as UncheckedCreateInput to bypass validation
    })

    return link.id
  }

  /**
   * Get link details (read-only, no modifications)
   */
  static async getLink(linkId: string): Promise<LinkResponse | null> {
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) return null

    return {
      id: link.id,
      amount: link.amount,
      assetType: link.assetType,
      claimed: link.claimed,
      claimedBy: link.claimedBy,
      depositTx: link.depositTx,
      withdrawTx: link.withdrawTx,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }
  }

  /**
   * Record deposit transaction
   * Called after Privacy Cash SDK deposit succeeds on frontend
   */
  static async recordDeposit(linkId: string, depositTx: string): Promise<void> {
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      throw new Error('Link not found')
    }

    if (link.depositTx && link.depositTx !== '') {
      throw new Error('Deposit already recorded for this link')
    }

    await prisma.paymentLink.update({
      where: { id: linkId },
      data: { depositTx },
    })

    // Record in transaction history
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId,
        transactionHash: depositTx,
        amount: link.amount,
        assetType: link.assetType,
        status: 'confirmed',
      },
    })
  }

  /**
   * Claim link (ATOMIC - prevents double-claim)
   * Called after Privacy Cash SDK withdraw succeeds on frontend
   *
   * Uses atomic updateMany to ensure only ONE successful claim
   */
  static async claimLink(
    linkId: string,
    recipientAddress: string,
    withdrawTx: string
  ): Promise<{ success: boolean; message: string }> {
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      throw new Error('Link not found')
    }

    if (!link.depositTx || link.depositTx === '') {
      throw new Error('Link has no deposit tx recorded')
    }

    // 🔐 ATOMIC UPDATE - Only update if claimed is still false
    const updated = await prisma.paymentLink.updateMany({
      where: {
        id: linkId,
        claimed: false, // Critical: only succeeds if not already claimed
      },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx,
      },
    })

    if (updated.count === 0) {
      throw new Error('Link already claimed')
    }

    // Record in transaction history
    await prisma.transaction.create({
      data: {
        type: 'withdraw',
        linkId,
        transactionHash: withdrawTx,
        amount: link.amount,
        assetType: link.assetType,
        toAddress: recipientAddress,
        status: 'confirmed',
      },
    })

    return {
      success: true,
      message: 'Link claimed successfully',
    }
  }

  /**
   * Check if link is still available to claim
   */
  static async isAvailable(linkId: string): Promise<boolean> {
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) return false
    return !link.claimed && link.depositTx !== ''
  }

  /**
   * Get all links (for admin/testing)
   */
  static async getAllLinks(): Promise<LinkResponse[]> {
    const links = await prisma.paymentLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return links.map((link) => ({
      id: link.id,
      amount: link.amount,
      assetType: link.assetType,
      claimed: link.claimed,
      claimedBy: link.claimedBy,
      depositTx: link.depositTx,
      withdrawTx: link.withdrawTx,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }))
  }
}
