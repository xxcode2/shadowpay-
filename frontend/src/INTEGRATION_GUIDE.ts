/**
 * SHADOWPAY - COMPLETE INTEGRATION GUIDE
 *
 * This file shows how to use ShadowPay in your application
 */

// ============= SENDER FLOW (Create & Deposit) =============

/*
Example: Sender creates a payment link and deposits funds

import { createPaymentLink } from '@/api/linkApi'
import { executeDeposit } from '@/flows/depositFlow'
import type { SigningWallet } from '@/services/privacyCashService'

async function senderFlow() {
  // Connect wallet (pseudocode)
  const wallet: SigningWallet = await connectWallet()

  // Step 1: Create payment link
  const link = await createPaymentLink({
    amount: 1 * 1e9, // 1 SOL
    assetType: 'SOL',
  })

  console.log('Link created:', link.linkId)
  console.log('Share URL:', link.shareUrl)

  // Step 2: Deposit funds via Privacy Cash SDK
  const deposit = await executeDeposit({
    linkId: link.linkId,
    lamports: 1 * 1e9,
    wallet,
    assetType: 'SOL',
  })

  console.log('Deposit tx:', deposit.depositTx)
  console.log('Share link:', link.shareUrl)

  // Now sender can share link.shareUrl with recipient
}
*/

// ============= RECEIVER FLOW (Get Link & Claim) =============

/*
Example: Receiver claims a payment link and withdraws funds

import { getLinkDetails } from '@/api/linkApi'
import { executeClaimLink } from '@/flows/claimLinkFlow'
import type { SigningWallet } from '@/services/privacyCashService'

async function receiverFlow(linkId: string) {
  // Connect wallet (pseudocode)
  const wallet: SigningWallet = await connectWallet()

  // Step 1: Fetch link details
  const link = await getLinkDetails(linkId)

  console.log('Receiving:', link.amount / 1e9, 'SOL')
  console.log('Asset type:', link.assetType)
  console.log('Already claimed:', link.claimed)

  if (link.claimed) {
    console.error('This link has already been claimed')
    return
  }

  // Step 2: Claim link and withdraw funds
  const claim = await executeClaimLink({
    linkId,
    recipientWallet: wallet,
  })

  console.log('Withdrawal tx:', claim.withdrawTx)
  console.log('Amount received:', claim.amountReceived / 1e9, 'SOL')
  console.log('Fee paid:', claim.feePaid / 1e9, 'SOL')
}
*/

// ============= ARCHITECTURE NOTES =============

/*
BACKEND (Express + Prisma):
- Endpoint: POST /api/create-link
  Input: { amount, assetType }
  Output: { linkId, shareUrl }

- Endpoint: POST /api/deposit
  Input: { linkId, depositTx }
  Output: { linkId, depositTx }

- Endpoint: POST /api/claim-link
  Input: { linkId, withdrawTx, recipientAddress }
  Output: { linkId, withdrawTx, claimedBy }
  CRITICAL: Uses atomic UPDATE to prevent double-claim

- Endpoint: GET /api/link/:id
  Output: Link details (metadata only)

FRONTEND (Privacy Cash SDK):
1. User connects wallet
2. User signs off-chain message to derive encryption key
3. User executes deposit: client.deposit({ lamports })
4. Frontend sends depositTx to backend
5. Link is ready to share

Receiver side:
1. Receiver opens link in browser
2. Receiver connects wallet
3. Receiver signs off-chain message
4. Receiver executes withdraw: client.withdraw({ lamports, recipientAddress })
5. Frontend sends withdrawTx to backend to claim link

DATABASE (Prisma):
model PaymentLink {
  id: String (unique identifier)
  amount: Float (in base units)
  assetType: String ('SOL', 'USDC', 'USDT')
  claimed: Boolean (false until withdrawn)
  claimedBy: String (recipient wallet address)
  depositTx: String (transaction hash from deposit)
  withdrawTx: String (transaction hash from withdrawal)
  createdAt: DateTime
  updatedAt: DateTime
}

SECURITY:
- Atomic UPDATE with WHERE claimed=false prevents double-claim
- Private keys NEVER leave wallet
- Encryption keys NEVER leave browser
- Backend is metadata-only (no custody)
- All Privacy Cash operations in frontend only
*/

// ============= ENVIRONMENT VARIABLES =============

/*
FRONTEND (.env.local):
VITE_BACKEND_URL=http://localhost:3000
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SHARE_BASE_URL=https://shadowpay.vercel.app

BACKEND (.env):
DATABASE_URL=postgresql://...
NODE_ENV=development
*/

// ============= ERROR HANDLING =============

/*
Common errors and how to handle them:

1. "Link not found"
   - Link ID is incorrect or link expired

2. "Link already claimed"
   - Someone already withdrew from this link

3. "Invalid recipient address"
   - Wallet address format is invalid

4. "Deposit already recorded for this link"
   - This link already has a deposit

5. "No private balance available"
   - User hasn't deposited any funds yet

6. "Failed to sign message"
   - User rejected the wallet signature request

7. "Insufficient balance"
   - User's on-chain SOL balance is too low

Always wrap Privacy Cash SDK calls in try/catch
*/

export const INTEGRATION_COMPLETE = true
