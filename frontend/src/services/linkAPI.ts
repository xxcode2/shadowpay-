/**
 * ✅ SHADOWPAY LINK API - Frontend Integration
 * 
 * ARCHITECTURE:
 * - User A deposits with their own wallet + gets link
 * - User B withdraws with their own wallet + claims link
 * - Backend only records TXs
 * 
 * Flow:
 * 1. createPaymentLink() - User A deposit + save to backend
 * 2. getPaymentLink() - Get link details (amount, status, etc)
 * 3. claimPaymentLink() - User B withdraw + record to backend
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * Load circuits for ZK proofs
 */
async function loadCircuits(): Promise<{
  wasm: Uint8Array
  zkey: Uint8Array
}> {
  const wasmResponse = await fetch('/circuits/transaction2.wasm')
  const zkeyResponse = await fetch('/circuits/transaction2.zkey')

  if (!wasmResponse.ok || !zkeyResponse.ok) {
    throw new Error('Failed to load circuits')
  }

  const wasm = new Uint8Array(await wasmResponse.arrayBuffer())
  const zkey = new Uint8Array(await zkeyResponse.arrayBuffer())

  return { wasm, zkey }
}

/**
 * Backend API URL
 */
function getApiUrl(): string {
  if (typeof window === 'undefined') {
    // SSR/Node
    return process.env.VITE_API_URL || 'http://localhost:5000'
  }
  return window.location.origin
}

/**
 * 1️⃣ CREATE PAYMENT LINK
 * 
 * User A deposits SOL with their wallet
 * Backend records the deposit TX + creates link
 * 
 * Flow:
 * 1. Load circuits
 * 2. Initialize Privacy Cash with User A's wallet
 * 3. Call SDK.deposit() with User A's keypair
 * 4. Get depositTx from SDK
 * 5. Send depositTx to backend
 * 6. Backend creates link + returns linkId
 * 
 * @param input - amount and wallet info
 * @returns linkId and shareUrl
 */
export async function createPaymentLink(input: {
  amount: number
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
  memo?: string
}): Promise<{
  linkId: string
  amount: number
  status: string
  depositTx: string
  shareUrl: string
}> {
  console.log(`\n🔐 CREATING PAYMENT LINK`)
  console.log(`   Amount: ${input.amount} SOL`)
  console.log(`   Wallet: ${input.wallet.publicKey.toString()}`)

  try {
    // ✅ STEP 1: Load circuits
    console.log(`📦 Loading circuits...`)
    const circuits = await loadCircuits()
    console.log(`✅ Circuits loaded\n`)

    // ✅ STEP 2: Setup Connection
    console.log(`🔄 Setting up Solana connection...`)
    const { Connection } = await import('@solana/web3.js')
    const { CONFIG } = await import('../config')
    const rpcUrl = process.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL
    const connection = new Connection(rpcUrl, 'confirmed')
    console.log(`✅ Connected to Solana\n`)

    // ✅ STEP 3: User A deposits to Privacy Cash
    console.log(`💸 Depositing ${input.amount} SOL to Privacy Cash pool...`)
    console.log(`⏳ This may take 60+ seconds...\n`)

    const lamports = Math.round(input.amount * LAMPORTS_PER_SOL)
    
    // Import the correct deposit function
    const { depositToPrivacyCash } = await import('./privacyCashClient.js')
    const depositResult = await depositToPrivacyCash({
      lamports,
      connection,
      wallet: input.wallet,
      onProgress: (msg) => console.log(`  ${msg}`)
    })

    const depositTx = depositResult.tx
    console.log(`✅ DEPOSIT SUCCESSFUL!`)
    console.log(`   TX: ${depositTx}\n`)

    // ✅ STEP 4: Send deposit TX to backend
    console.log(`📤 Creating link on backend...`)
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: input.amount,
        depositTx: depositTx,
        memo: input.memo || 'ShadowPay payment',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Backend error: ${error.error}`)
    }

    const link = await response.json()
    console.log(`✅ LINK CREATED!`)
    console.log(`   Link ID: ${link.linkId}`)
    console.log(`   Share: ${link.shareUrl}\n`)

    return link

  } catch (error: any) {
    console.error(`❌ Failed to create link:`)
    console.error(`   ${error.message}\n`)
    throw new Error(`Failed to create payment link: ${error.message}`)
  }
}

/**
 * 2️⃣ GET PAYMENT LINK
 * 
 * Retrieve link details (amount, status, etc)
 * Used when recipient opens the link
 * 
 * @param linkId - The link identifier
 * @returns Link details
 */
export async function getPaymentLink(linkId: string): Promise<{
  linkId: string
  amount: number
  assetType: string
  status: string
  claimed: boolean
  claimedBy: string | null
  createdAt: string
  expiryAt: string
}> {
  console.log(`\n👁️ PREVIEWING LINK`)
  console.log(`   LinkId: ${linkId}`)

  try {
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/links/${linkId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Link not found')
    }

    const link = await response.json()
    console.log(`✅ Found: ${link.amount} ${link.assetType}`)
    console.log(`   Status: ${link.status}`)
    console.log(`   Expires: ${link.expiryAt}\n`)

    return link

  } catch (error: any) {
    console.error(`❌ Failed to get link: ${error.message}\n`)
    throw new Error(`Failed to get link details: ${error.message}`)
  }
}

/**
 * 3️⃣ CLAIM PAYMENT LINK
 * 
 * User B withdraws SOL with their wallet
 * Backend records the withdrawal TX + marks link as claimed
 * 
 * Flow:
 * 1. Get link details (for amount)
 * 2. Load circuits
 * 3. Initialize Privacy Cash with User B's wallet
 * 4. Call SDK.withdraw() with User B's wallet + amount
 * 5. Get withdrawTx from SDK
 * 6. Send withdrawTx to backend
 * 7. Backend records claim + returns success
 * 
 * @param input - linkId, recipient wallet, and address
 * @returns withdrawal result
 */
export async function claimPaymentLink(input: {
  linkId: string
  recipientWallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
}): Promise<{
  success: boolean
  linkId: string
  withdrawTx: string
  recipient: string
  amount: number
  status: string
}> {
  console.log(`\n🎁 CLAIMING PAYMENT LINK`)
  console.log(`   LinkId: ${input.linkId}`)
  console.log(`   Recipient: ${input.recipientWallet.publicKey.toString()}`)

  try {
    // ✅ STEP 1: Get link details from backend (for amount!)
    console.log(`🔍 Fetching link details...`)
    const link = await getPaymentLink(input.linkId)

    if (link.claimed) {
      throw new Error('Link already claimed')
    }

    if (link.status !== 'active') {
      throw new Error(`Link is ${link.status}, cannot claim`)
    }

    const amount = link.amount
    console.log(`✅ Amount to withdraw: ${amount} SOL\n`)

    // ✅ STEP 2: Load circuits
    console.log(`📦 Loading circuits...`)
    const circuits = await loadCircuits()
    console.log(`✅ Circuits loaded\n`)

    // ✅ STEP 3: Setup Connection
    console.log(`🔄 Setting up Solana connection...`)
    const { Connection } = await import('@solana/web3.js')
    const { CONFIG } = await import('../config')
    const rpcUrl2 = process.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL
    const connection = new Connection(rpcUrl2, 'confirmed')
    console.log(`✅ Connected to Solana\n`)

    // ✅ STEP 4: User B withdraws from Privacy Cash
    console.log(`📤 Withdrawing ${amount} SOL from Privacy Cash pool...`)
    console.log(`⏳ This may take 60+ seconds...\n`)

    const lamports = Math.round(amount * LAMPORTS_PER_SOL)
    
    // Import the correct withdraw function
    const { withdrawFromPrivacyCash } = await import('./privacyCashClient.js')
    const withdrawResult = await withdrawFromPrivacyCash({
      lamports,
      recipientAddress: input.recipientWallet.publicKey.toString(),
      connection,
      wallet: input.recipientWallet,
      onProgress: (msg) => console.log(`  ${msg}`)
    })

    const withdrawTx = withdrawResult.tx
    console.log(`✅ WITHDRAWAL SUCCESSFUL!`)
    console.log(`   TX: ${withdrawTx}`)
    console.log(`   Received: ${amount} SOL\n`)

    // ✅ STEP 5: Record withdrawal on backend
    console.log(`📝 Recording claim on backend...`)
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/links/${input.linkId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawTx: withdrawTx,
        recipient: input.recipientWallet.publicKey.toString(),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Backend error: ${error.error}`)
    }

    const result = await response.json()
    console.log(`✅ LINK CLAIMED!`)
    console.log(`   Status: ${result.status}`)
    console.log(`   Amount: ${result.amount} SOL\n`)

    return result

  } catch (error: any) {
    console.error(`❌ Failed to claim link:`)
    console.error(`   ${error.message}\n`)
    throw new Error(`Failed to claim payment link: ${error.message}`)
  }
}

/**
 * Export all functions
 */
export const LinkAPI = {
  createPaymentLink,
  getPaymentLink,
  claimPaymentLink,
  loadCircuits,
}
