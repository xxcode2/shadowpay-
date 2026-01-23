import { PrivacyCash } from 'privacycash'
import { PublicKey } from '@solana/web3.js'
import { PrivacyCashService, SigningWallet } from '../services/privacyCashService.js'

const SOLANA_RPC_URL = process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000'

/**
 * Withdraw Flow (Claim Link)
 *
 * Receiver side:
 * 1. Receiver scans QR or receives link with linkId
 * 2. Receiver connects wallet
 * 3. Receiver signs encryption message
 * 4. Receiver withdraws funds via Privacy Cash SDK to their wallet
 * 5. Frontend sends withdrawTx to backend to mark link as claimed
 */

export interface ClaimLinkInput {
  linkId: string
  recipientWallet: SigningWallet
  lamports?: number // Amount to withdraw. If not provided, withdraw full amount
  assetType?: 'SOL' | 'USDC' | 'USDT'
}

export interface ClaimLinkResult {
  success: boolean
  withdrawTx: string
  linkId: string
  recipientAddress: string
  amountReceived: number
  feePaid: number
  message: string
}

/**
 * Execute claim link (withdraw) flow end-to-end
 */
export async function executeClaimLink(input: ClaimLinkInput): Promise<ClaimLinkResult> {
  const { linkId, recipientWallet, assetType = 'SOL' } = input

  try {
    console.log(`\n🚀 Starting claim link flow...`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   Recipient: ${recipientWallet.publicKey.toBase58()}`)

    // ✅ Step 1: Fetch link details from backend
    console.log(`\n1️⃣ Fetching link details...`)
    const linkResponse = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!linkResponse.ok) {
      throw new Error('Link not found')
    }

    const linkData = await linkResponse.json()
    const { amount, claimed } = linkData

    if (claimed) {
      throw new Error('Link already claimed')
    }

    const withdrawAmount = input.lamports || amount
    console.log(`✅ Link found. Amount: ${withdrawAmount / 1e9} SOL`)

    // ✅ Step 2: Ensure encryption key is derived
    console.log(`\n2️⃣ Deriving encryption key...`)
    if (!PrivacyCashService.isReady()) {
      await PrivacyCashService.deriveEncryptionKey(recipientWallet)
    }

    // ✅ Step 3: Initialize Privacy Cash client
    // Note: owner NOT passed in frontend mode - SDK uses encryption key + wallet signer
    console.log(`\n3️⃣ Initializing Privacy Cash client...`)
    const client = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      enableDebug: false,
    } as any)

    // ✅ Step 4: Execute withdraw via Privacy Cash SDK
    console.log(`\n4️⃣ Executing withdrawal via Privacy Cash SDK...`)
    let withdrawResult
    if (assetType === 'SOL') {
      withdrawResult = await client.withdraw({
        lamports: withdrawAmount,
        recipientAddress: recipientWallet.publicKey.toBase58(),
      })
    } else {
      throw new Error(`${assetType} withdrawals not yet implemented`)
    }

    const withdrawTx = withdrawResult.tx
    console.log(`✅ Withdrawal successful! Tx: ${withdrawTx}`)
    console.log(`   Amount received: ${withdrawResult.amount_in_lamports / 1e9} SOL`)
    console.log(`   Fee paid: ${withdrawResult.fee_in_lamports / 1e9} SOL`)

    // ✅ Step 5: Mark link as claimed on backend (ATOMIC)
    console.log(`\n5️⃣ Marking link as claimed on backend...`)
    const claimResponse = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId,
        withdrawTx,
        recipientAddress: recipientWallet.publicKey.toBase58(),
      }),
    })

    if (!claimResponse.ok) {
      const error = await claimResponse.json()
      throw new Error(`Backend error: ${error.error || 'Failed to claim link'}`)
    }

    const claimData = await claimResponse.json()

    console.log(`✅ Link marked as claimed on backend`)
    console.log(`\n✅ Claim flow completed!`)
    console.log(`   Funds received: ${withdrawResult.amount_in_lamports / 1e9} SOL`)

    return {
      success: true,
      withdrawTx,
      linkId,
      recipientAddress: recipientWallet.publicKey.toBase58(),
      amountReceived: withdrawResult.amount_in_lamports,
      feePaid: withdrawResult.fee_in_lamports,
      message: 'Link claimed successfully. Funds withdrawn.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ Claim flow failed: ${message}`)
    throw error
  }
}

/**
 * Helper to check private balance before claiming
 */
export async function checkPrivateBalance(wallet: SigningWallet): Promise<number> {
  try {
    // Ensure encryption key is derived
    if (!PrivacyCashService.isReady()) {
      await PrivacyCashService.deriveEncryptionKey(wallet)
    }

    const client = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      enableDebug: false,
    } as any) // Frontend mode: SDK uses encryption key + wallet signer, not owner

    const balance = await client.getPrivateBalance()
    console.log(`🔍 Private balance: ${balance.lamports / 1e9} SOL`)
    return balance.lamports
  } catch (error) {
    console.error('❌ Failed to check balance:', error)
    throw error
  }
}
