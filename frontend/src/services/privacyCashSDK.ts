/**
 * ✅ CLEAN PRIVACY CASH INTEGRATION
 * 
 * Frontend integration following SDK approach:
 * - SDK handle all complexity
 * - NO manual merkle/nullifier/circuit building
 * - Simple deposit & withdraw
 */

import { PrivacyCash } from 'privacycash'
import { PublicKey } from '@solana/web3.js'

/**
 * Load circuits from public folder
 * Same approach as frontend
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
 * CREATE LINK - User A deposits to Privacy Cash
 * 
 * Flow:
 * 1. Load circuits
 * 2. Initialize SDK with user's wallet
 * 3. Call SDK.deposit()
 * 4. SDK generates ZK proof + submits
 * 5. Return linkId
 * 6. Backend saves linkId
 * 
 * ✅ Non-custodial: Funds go to Privacy Cash pool, not ShadowPay
 */
export async function createPaymentLink(input: {
  amountSol: number
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
}): Promise<string> {
  console.log(`🔐 Creating payment link...`)
  console.log(`   Amount: ${input.amountSol} SOL\n`)

  try {
    // Load circuits (same as backend test)
    console.log(`📦 Loading circuits...`)
    const circuits = await loadCircuits()
    console.log(`✅ Circuits loaded\n`)

    // Initialize Privacy Cash with user's wallet
    console.log(`🔄 Initializing Privacy Cash SDK...`)
    const rpcUrl = process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const pc = new PrivacyCash(input.wallet as any, rpcUrl)
    console.log(`✅ SDK ready\n`)

    // DEPOSIT - This is all we need to call!
    // SDK handle: merkle proofs, ZK circuits, blockchain submission
    console.log(`💸 Depositing to Privacy Cash pool...`)
    console.log(`⏳ This may take 60+ seconds...\n`)

    const linkId = await pc.deposit(input.amountSol * 1e9, {
      prover: circuits,
      // ✅ That's it!
      // ❌ NO buildCircuitInput
      // ❌ NO inPathIndices / inPathElements
      // ❌ NO manual merkle operations
      // ❌ NO nullifier management
    })

    console.log(`✅ DEPOSIT SUCCESSFUL!`)
    console.log(`   Link ID: ${linkId}\n`)

    return linkId

  } catch (error: any) {
    console.error(`❌ Failed to create link:`)
    console.error(`   ${error.message}\n`)
    throw new Error(`Failed to create payment link: ${error.message}`)
  }
}

/**
 * CLAIM LINK - User B withdraws from Privacy Cash
 * 
 * Flow:
 * 1. Load circuits
 * 2. Initialize SDK with recipient's wallet
 * 3. Call SDK.withdraw(linkId)
 * 4. SDK generates ZK proof + submits
 * 5. Funds sent to recipient's wallet
 * 6. Return withdrawal TX hash
 * 
 * ✅ Non-custodial: User B use their own wallet, full control
 */
export async function claimPaymentLink(input: {
  linkId: string
  recipientWallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
}): Promise<{
  withdrawTx: string
  linkId: string
  recipient: string
}> {
  console.log(`🎁 Claiming payment link...`)
  console.log(`   Link ID: ${input.linkId}`)
  console.log(`   Recipient: ${input.recipientWallet.publicKey.toString()}\n`)

  try {
    // Load circuits
    console.log(`📦 Loading circuits...`)
    const circuits = await loadCircuits()
    console.log(`✅ Circuits loaded\n`)

    // Initialize Privacy Cash with RECIPIENT's wallet
    // This is key - user has full control
    console.log(`🔄 Initializing Privacy Cash SDK...`)
    const rpcUrl = process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const pc = new PrivacyCash(input.recipientWallet as any, rpcUrl)
    console.log(`✅ SDK ready\n`)

    // WITHDRAW - This is all we need to call!
    // SDK handle: merkle proofs, ZK circuits, blockchain submission
    console.log(`📤 Withdrawing from Privacy Cash pool...`)
    console.log(`⏳ This may take 60+ seconds...\n`)

    const withdrawTx = await pc.withdraw(
      0, // Amount is in linkId, SDK knows it
      input.recipientWallet.publicKey.toString(),
      {
        prover: circuits,
        // ✅ That's it!
        // ❌ NO merkle tree reconstruction
        // ❌ NO manual proof generation
        // ❌ NO nullifier tracking
      }
    )

    console.log(`✅ WITHDRAWAL SUCCESSFUL!`)
    console.log(`   TX Hash: ${withdrawTx}`)
    console.log(`   Recipient: ${input.recipientWallet.publicKey.toString()}\n`)

    return {
      withdrawTx,
      linkId: input.linkId,
      recipient: input.recipientWallet.publicKey.toString(),
    }

  } catch (error: any) {
    console.error(`❌ Failed to claim link:`)
    console.error(`   ${error.message}\n`)
    throw new Error(`Failed to claim payment link: ${error.message}`)
  }
}

/**
 * Export for use in React components
 */
export const PrivacyCashIntegration = {
  createPaymentLink,
  claimPaymentLink,
  loadCircuits,
}
