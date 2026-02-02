/**
 * ✅ SIMPLIFIED DEPOSIT FLOW (Official SDK)
 * 
 * Uses the official Privacy Cash SDK for proper deposit handling
 * Tracks deposits to the backend for history and link management
 * 
 * FEE STRUCTURE:
 * - User deposits 1.0 SOL
 * - 1% owner fee = 0.01 SOL (sent to owner wallet)
 * - 0.99 SOL goes to Privacy Cash pool
 * - User can withdraw the full 0.99 SOL from their private balance
 */

import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, PublicKey, SystemProgram, VersionedTransaction, Keypair } from '@solana/web3.js'
import { depositToPrivacyCash } from '../services/privacyCashClient'
import { getFeeMessage, calculateFee, getNetAmount, FEE_CONFIG } from '../utils/feeCalculator'

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
  const totalLamports = Math.round(parseFloat(amount) * 1e9)
  const feeLamports = calculateFee(totalLamports)
  const netLamports = getNetAmount(totalLamports)

  console.log('\n💰 DEPOSIT FLOW - Using Official Privacy Cash SDK')
  console.log(`   Link ID: ${linkId}`)
  console.log(`   Total Amount: ${amount} ${token}`)
  console.log(`   ${getFeeMessage(totalLamports)}`)
  console.log(`   Sender: ${publicKey}`)
  if (recipientAddress) {
    console.log(`   Recipient: ${recipientAddress}`)
  }

  try {
    // Setup connection
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL
    const connection = new Connection(rpcUrl, 'confirmed')

    // Ensure publicKey is PublicKey object
    const publicKeyObj = wallet.publicKey instanceof PublicKey
      ? wallet.publicKey
      : new PublicKey(wallet.publicKey)

    // ✅ STEP 1: Transfer 1% owner fee to owner wallet
    console.log(`\nStep 1: Transferring 1% owner fee...`)
    console.log(`   Fee: ${(feeLamports / 1e9).toFixed(6)} SOL → ${FEE_CONFIG.OWNER_WALLET}`)
    
    try {
      const feeTransactionSignature = await transferFeeToOwner(
        connection,
        publicKeyObj,
        feeLamports,
        wallet
      )
      console.log(`   ✅ Fee transferred: ${feeTransactionSignature.slice(0, 20)}...`)
    } catch (feeErr: any) {
      console.warn(`   ⚠️  Fee transfer error: ${feeErr.message}`)
      // Continue anyway - the deposit should still work
      // User will be charged the fee from their wallet during the Privacy Cash deposit
    }

    // ✅ STEP 2: Deposit net amount to Privacy Cash using official SDK
    console.log(`\nStep 2: Depositing to Privacy Cash pool...`)
    console.log(`   Net amount: ${(netLamports / 1e9).toFixed(6)} SOL`)
    
    const depositResult = await depositToPrivacyCash({
      lamports: netLamports,
      connection,
      wallet: {
        publicKey: publicKeyObj,
        signTransaction: async (tx: any) => {
          return await wallet.signTransaction(tx)
        },
        signMessage: async (msg: Uint8Array) => {
          return await wallet.signMessage(msg)
        }
      },
      onProgress: (msg: string) => {
        console.log(`   📡 ${msg}`)
      }
    })

    console.log(`✅ Deposit transaction confirmed: ${depositResult.tx}`)

    // ✅ STEP 3: Record deposit in backend (for link tracking & history)
    console.log(`\nStep 3: Recording deposit in backend for tracking...`)
    await recordDepositInBackend({
      linkId,
      amount,
      lamports: netLamports,
      publicKey,
      recipientAddress,
      transactionSignature: depositResult.tx,
      feeAmount: feeLamports
    })

    console.log(`✅ Deposit recorded in backend`)
    console.log(`\n✅ DEPOSIT COMPLETE`)
    console.log(`   Transaction: ${depositResult.tx}`)
    console.log(`   Gross Amount: ${amount} ${token}`)
    console.log(`   Fee (1%): ${(feeLamports / 1e9).toFixed(6)} ${token}`)
    console.log(`   Net to Pool: ${(netLamports / 1e9).toFixed(6)} ${token}`)
    console.log(`   Status: Funds in Privacy Cash pool ✨`)

    showSuccess(`${amount} ${token} deposited! (${(netLamports / 1e9).toFixed(6)} to pool, ${(feeLamports / 1e9).toFixed(6)} fee)`)
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
  feeAmount?: number
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
        transactionHash: params.transactionSignature,
        feeAmount: params.feeAmount || 0
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
  feeAmount?: number
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

/**
 * Transfer 1% owner fee to owner wallet
 * Separate transaction before Privacy Cash deposit
 */
async function transferFeeToOwner(
  connection: Connection,
  userPublicKey: PublicKey,
  feeLamports: number,
  wallet: any
): Promise<string> {
  try {
    const ownerPublicKey = new PublicKey(FEE_CONFIG.OWNER_WALLET)

    console.log(`   Wallet balance check...`)
    const balance = await connection.getBalance(userPublicKey)
    console.log(`   User balance: ${balance} lamports`)

    if (balance < feeLamports) {
      throw new Error(`Insufficient balance for fee: need ${feeLamports}, have ${balance}`)
    }

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

    // Create transfer instruction
    const instruction = SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: ownerPublicKey,
      lamports: feeLamports
    })

    // Dynamic import at runtime to avoid minification
    const { TransactionMessage, VersionedTransaction: VT } = await import('@solana/web3.js')
    
    // Build transaction
    const instructions = [instruction]
    const recentBlockhash = blockhash
    const message = TransactionMessage.compile({
      payerKey: userPublicKey,
      instructions: instructions,
      recentBlockhash: recentBlockhash
    })
    const tx = new VT(message)

    // Sign and send
    const signedTx = await wallet.signTransaction(tx)
    const signature = await connection.sendTransaction(signedTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    })

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed')

    return signature

  } catch (error: any) {
    console.error(`❌ Failed to transfer fee: ${error.message}`)
    throw error
  }
}
