const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

/**
 * Create Link API
 * Calls backend to create a new payment link
 */

export interface CreateLinkInput {
  amount: number
  assetType: 'SOL' | 'USDC' | 'USDT'
}

export interface CreateLinkResult {
  linkId: string
  amount: number
  assetType: string
  shareUrl: string
}

export async function createPaymentLink(input: CreateLinkInput): Promise<CreateLinkResult> {
  try {
    console.log(`🔗 Creating payment link...`)
    console.log(`   Amount: ${input.amount / 1e9} ${input.assetType}`)

    const response = await fetch(`${BACKEND_URL}/api/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create link')
    }

    const data = await response.json()

    console.log(`✅ Link created: ${data.linkId}`)
    console.log(`   Share URL: ${data.shareUrl}`)

    return {
      linkId: data.linkId,
      amount: data.amount,
      assetType: data.assetType,
      shareUrl: data.shareUrl,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed to create link: ${message}`)
    throw error
  }
}

/**
 * Get Link Details
 * Fetch link info from backend
 */
export interface LinkDetails {
  id: string
  amount: number
  assetType: string
  claimed: boolean
  claimedBy: string | null
  depositTx: string
  withdrawTx: string | null
  createdAt: string
  updatedAt: string
}

export async function getLinkDetails(linkId: string): Promise<LinkDetails> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!response.ok) {
      throw new Error('Link not found')
    }

    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed to fetch link: ${message}`)
    throw error
  }
}
