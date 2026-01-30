/**
 * ✅ SHADOWPAY LINK API - Frontend only
 * 
 * Communicates with backend for all link operations.
 * Backend handles Privacy Cash SDK calls.
 * 
 * NO SDK CALLS FROM FRONTEND!
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export interface CreateLinkRequest {
  amount: number  // in SOL
  memo?: string
  expiryDays?: number
}

export interface CreateLinkResponse {
  success: boolean
  linkId: string
  amount: number
  status: 'active'
  depositTx: string
  shareUrl: string
  message: string
}

export interface LinkDetails {
  linkId: string
  amount: number
  assetType: string
  status: 'active' | 'claimed' | 'expired'
  claimed: boolean
  claimedBy: string | null
  createdAt: string
  expiryAt: string
}

export interface ClaimLinkRequest {
  recipientAddress: string  // Solana address
}

export interface ClaimLinkResponse {
  success: boolean
  linkId: string
  withdrawTx: string
  recipient: string
  amount: number
  status: 'claimed'
  message: string
}

/**
 * 1️⃣  CREATE LINK - Backend deposits to Privacy Cash
 * 
 * POST /api/links
 * {
 *   amount: 0.25,
 *   memo?: "payment",
 *   expiryDays?: 7
 * }
 * 
 * Returns: { linkId, amount, status, depositTx, shareUrl }
 */
export async function createPaymentLink(request: CreateLinkRequest): Promise<CreateLinkResponse> {
  console.log(`\n📝 CREATE LINK`)
  console.log(`   Amount: ${request.amount} SOL`)
  console.log(`   Calling: POST /api/links`)

  try {
    const response = await fetch(`${API_BASE_URL}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create link')
    }

    const data = await response.json() as CreateLinkResponse
    console.log(`✅ Link created: ${data.linkId}`)
    console.log(`   Share URL: ${data.shareUrl}`)

    return data

  } catch (error: any) {
    console.error(`❌ Create link failed:`, error.message)
    throw new Error(`Failed to create payment link: ${error.message}`)
  }
}

/**
 * 2️⃣  GET LINK DETAILS - Preview link
 * 
 * GET /api/links/:id
 * 
 * Returns: { linkId, amount, status, claimed, claimedBy, expiryAt }
 */
export async function getPaymentLink(linkId: string): Promise<LinkDetails> {
  console.log(`\n👁️  GET LINK DETAILS`)
  console.log(`   LinkId: ${linkId}`)
  console.log(`   Calling: GET /api/links/${linkId}`)

  try {
    const response = await fetch(`${API_BASE_URL}/links/${linkId}`)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Link not found')
      }
      const error = await response.json()
      throw new Error(error.error || 'Failed to get link')
    }

    const data = await response.json() as LinkDetails
    console.log(`✅ Link found`)
    console.log(`   Amount: ${data.amount} SOL`)
    console.log(`   Status: ${data.status}`)

    return data

  } catch (error: any) {
    console.error(`❌ Get link failed:`, error.message)
    throw new Error(`Failed to get payment link: ${error.message}`)
  }
}

/**
 * 3️⃣  CLAIM LINK - Backend withdraws from Privacy Cash
 * 
 * POST /api/links/:id/claim
 * {
 *   recipientAddress: "ABC123..."
 * }
 * 
 * Returns: { success, linkId, withdrawTx, recipient, amount, status }
 */
export async function claimPaymentLink(
  linkId: string,
  recipientAddress: string
): Promise<ClaimLinkResponse> {
  console.log(`\n🎁 CLAIM LINK`)
  console.log(`   LinkId: ${linkId}`)
  console.log(`   Recipient: ${recipientAddress}`)
  console.log(`   Calling: POST /api/links/${linkId}/claim`)

  try {
    const response = await fetch(`${API_BASE_URL}/links/${linkId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientAddress }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to claim link')
    }

    const data = await response.json() as ClaimLinkResponse
    console.log(`✅ Link claimed!`)
    console.log(`   TX: ${data.withdrawTx}`)
    console.log(`   Amount: ${data.amount} SOL received`)

    return data

  } catch (error: any) {
    console.error(`❌ Claim link failed:`, error.message)
    throw new Error(`Failed to claim payment link: ${error.message}`)
  }
}

/**
 * Export for use in React components
 */
export const LinkAPI = {
  createPaymentLink,
  getPaymentLink,
  claimPaymentLink,
}
