/**
 * ✅ SIMPLIFIED DEPOSIT FLOW (Official SDK)
 * 
 * Uses the official Privacy Cash SDK for proper deposit handling
 * Tracks deposits to the backend for history and link management
 */

import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, PublicKey } from '@solana/web3.js'
import { depositToPrivacyCash } from '../services/privacyCashClient'

export interface DepositRequest {
  linkId: string
  amount: string  // SOL amount as string
  publicKey: string
  recipientAddress?: string  // ✅ For send-to-user flows
  token?: string
}

/**
 * Main deposit function
 * Handles both "Create Link" (self-deposit) and "Send to User" (recipient deposit) flows
 */
export async function executeDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey, recipientAddress, token = 'SOL' } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('\n💰 DEPOSIT FLOW - Using Official Privacy Cash SDK')
  console.log(`   Link ID: ${linkId}`)
  console.log(`   Amount: ${amount} ${token}`)
  console.log(`   Sender: ${publicKey}`)
  if (recipientAddress) {
    console.log(`   Recipient: ${recipientAddress}`)
  }

  try {
    // Setup connection
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL ||
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
    const connection = new Connection(rpcUrl, 'confirmed')

    // Ensure publicKey is PublicKey object
    const publicKeyObj = wallet.publicKey instanceof PublicKey
      ? wallet.publicKey
      : new PublicKey(wallet.publicKey)

    // ✅ STEP 1: Deposit to Privacy Cash using official SDK
    console.log(`\nStep 1: Depositing to Privacy Cash pool...`)
    const depositResult = await depositToPrivacyCash({
      lamports,
      connection,
      wallet: {
        publicKey: publicKeyObj,
        signTransaction: async (tx: any) => {
          return await wallet.signTransaction(tx)
        }
      },
      onProgress: (msg: string) => {
        console.log(`   📡 ${msg}`)
      }
    })

    console.log(`✅ Deposit transaction confirmed: ${depositResult.tx}`)

    // ✅ STEP 2: Record deposit in backend (for link tracking & history)
    console.log(`\nStep 2: Recording deposit in backend for tracking...`)
    await recordDepositInBackend({
      linkId,
      amount,
      lamports,
      publicKey,
      recipientAddress,
      transactionSignature: depositResult.tx
    })

    console.log(`✅ Deposit recorded in backend`)
    console.log(`\n✅ DEPOSIT COMPLETE`)
    console.log(`   Transaction: ${depositResult.tx}`)
    console.log(`   Amount: ${amount} ${token}`)
    console.log(`   Status: Funds in Privacy Cash pool ✨`)

    showSuccess(`${amount} ${token} deposited to Privacy Cash!`)
    return depositResult.tx

  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`\n❌ DEPOSIT FAILED: ${errorMsg}`)
    showError(`Deposit failed: ${errorMsg}`)
    throw error
  }
}

/**
 * Record deposit in backend database
 * Non-critical - deposit is already confirmed on-chain
 * Used for: link tracking, incoming payment history, balance tracking
 */
async function recordDepositInBackend(params: {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  recipientAddress?: string
  transactionSignature: string
}): Promise<void> {
  const url = `${CONFIG.BACKEND_URL}/api/deposit/record`

  console.log(`   📤 Recording with backend...`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId: params.linkId,
        amount: params.amount,
        lamports: params.lamports,
        publicKey: params.publicKey,
        recipientAddress: params.recipientAddress,
        transactionHash: params.transactionSignature
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.warn(`   ⚠️  Backend error (${response.status}):`, errorData.error)

      // Try fallback endpoint
      if (response.status === 404) {
        await recordDepositWithFallback(params)
        return
      }

      // Log the error but don't fail - deposit is already on-chain
      console.warn(`   ⚠️  Backend recording failed, but deposit is safe on-chain`)
      return
    }

    const result = await response.json()
    console.log(`   ✅ Recorded successfully`)

  } catch (error: any) {
    console.warn(`   ⚠️  Backend recording error:`, error.message)
    // Continue - deposit is already confirmed on-chain
  }
}

/**
 * Fallback endpoint if primary endpoint fails
 */
async function recordDepositWithFallback(params: {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  recipientAddress?: string
  transactionSignature: string
}): Promise<void> {
  const url = `${CONFIG.BACKEND_URL}/api/deposit/verify-and-record`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId: params.linkId,
        transactionHash: params.transactionSignature,
        publicKey: params.publicKey
      })
    })

    if (response.ok) {
      console.log(`   ✅ Recorded via fallback endpoint`)
    }
  } catch (error: any) {
    console.warn(`   ⚠️  Fallback also failed:`, error.message)
  }
}
