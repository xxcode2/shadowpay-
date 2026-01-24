import { PrivacyCash } from 'privacycash'
import { PublicKey } from '@solana/web3.js'
import { PrivacyCashService, SigningWallet } from '../services/privacyCashService.js'

const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

/**
 * Deposit Flow
 *
 * 1. User creates a payment link (get linkId from backend)
 * 2. User connects wallet and signs encryption message
 * 3. User deposits SOL/tokens via Privacy Cash SDK
 * 4. Frontend sends depositTx to backend to record it
 */

export interface DepositFlowInput {
  linkId: string
  lamports: number
  wallet: SigningWallet
  assetType?: 'SOL' | 'USDC' | 'USDT'
}

export interface DepositFlowResult {
  success: boolean
  depositTx: string
  linkId: string
  amount: number
  message: string
}

/**
 * Execute deposit flow end-to-end
 */
export async function executeDeposit(input: DepositFlowInput): Promise<DepositFlowResult> {
  const { linkId, lamports, wallet, assetType = 'SOL' } = input

  try {
    console.log(`\n🚀 Starting deposit flow...`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   Amount: ${lamports / 1e9} SOL`)

    // ✅ Step 1: Ensure encryption key is derived
    console.log(`\n1️⃣ Deriving encryption key...`)
    if (!PrivacyCashService.isReady()) {
      await PrivacyCashService.deriveEncryptionKey(wallet)
    }

    // ✅ Step 2: Initialize Privacy Cash client
    // Note: owner NOT passed in frontend mode - SDK uses encryption key + wallet signer
    console.log(`\n2️⃣ Initializing Privacy Cash client...`)
    const client = new PrivacyCash({
      RPC_url: SOLANA_RPC_URL,
      enableDebug: false,
    } as any)

    // ✅ Step 3: Execute deposit via Privacy Cash SDK
    console.log(`\n3️⃣ Executing deposit via Privacy Cash SDK...`)
    let depositResult
    if (assetType === 'SOL') {
      depositResult = await client.deposit({ lamports })
    } else {
      // SPL token deposit
      throw new Error(`${assetType} deposits not yet implemented`)
    }

    const depositTx = depositResult.tx
    console.log(`✅ Deposit successful! Tx: ${depositTx}`)

    // ✅ Step 4: Record deposit on backend
    console.log(`\n4️⃣ Recording deposit on backend...`)
    const response = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId,
        depositTx,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Backend error: ${error.error || 'Failed to record deposit'}`)
    }

    const backendData = await response.json()

    console.log(`✅ Deposit recorded on backend`)
    console.log(`\n✅ Deposit flow completed!`)
    console.log(`   Share link: https://shadowpay.vercel.app?link=${linkId}`)

    return {
      success: true,
      depositTx,
      linkId,
      amount: lamports,
      message: 'Deposit successful. Link is ready to share.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ Deposit flow failed: ${message}`)
    throw error
  }
}

/**
 * Helper to check balance
 */
export async function checkBalance(wallet: SigningWallet): Promise<number> {
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
