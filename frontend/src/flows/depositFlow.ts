import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { executeNonCustodialDeposit, WalletAdapter } from '../services/browserDeposit'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * NON-CUSTODIAL DEPOSIT FLOW
 *
 * This is the correct non-custodial flow where:
 * - User's wallet derives encryption keys (not operator's)
 * - ZK proofs are generated in the browser
 * - User signs the deposit transaction directly
 * - Transaction is submitted to Privacy Cash relayer
 * - UTXOs are encrypted with user's keys (only user can spend)
 *
 * Flow:
 * 1. User signs "Privacy Money account sign in" message → derives encryption key
 * 2. Browser generates ZK proof using snarkjs
 * 3. Browser creates deposit transaction
 * 4. User signs transaction with Phantom
 * 5. Transaction is relayed to Privacy Cash indexer
 * 6. Backend records the transaction (for link tracking)
 *
 * Security:
 * - Operator NEVER has access to user's UTXO keys
 * - Only the user can decrypt and spend their private balance
 * - True non-custodial privacy
 */
export async function executeUserPaysDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('\n💰 Processing NON-CUSTODIAL deposit...')
  console.log(`   Step 1: Sign message to derive your encryption key`)
  console.log(`   Step 2: Generate ZK proof in browser`)
  console.log(`   Step 3: Sign deposit transaction`)
  console.log(`   Step 4: Submit to Privacy Cash`)

  try {
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL ||
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

    const connection = new Connection(rpcUrl)

    // Create wallet adapter interface
    const walletAdapter: WalletAdapter = {
      publicKey: wallet.publicKey,
      signMessage: async (message: Uint8Array) => {
        return await wallet.signMessage(message)
      },
      signTransaction: async (transaction: any) => {
        return await wallet.signTransaction(transaction)
      }
    }

    // Execute non-custodial deposit
    const result = await executeNonCustodialDeposit({
      wallet: walletAdapter,
      lamports,
      connection,
      onProgress: (step, detail) => {
        console.log(`   ${step}${detail ? ': ' + detail : ''}`)
      }
    })

    // Record transaction in backend (for link tracking only)
    try {
      await recordDepositInBackend({
        linkId,
        amount,
        lamports,
        publicKey,
        transactionSignature: result.transactionSignature
      })
    } catch (recordErr: any) {
      // Non-critical - deposit succeeded even if recording fails
      console.error('❌ Failed to record deposit in backend:', recordErr.message || recordErr)
      console.warn('   ⚠️  Your deposit is safe on Privacy Cash, but link tracking failed.')
      console.warn('   ⚠️  You may need to manually record this transaction.')
    }

    console.log(`\n✅ SUCCESS`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Transaction: ${result.transactionSignature}`)

    const message = `${amount} SOL successfully deposited to Privacy Cash!`
    showSuccess(`${message} View on Solscan: ${result.explorerUrl}`)

    return result.transactionSignature

  } catch (error: any) {
    const errorMsg = error.message || 'Deposit failed'
    console.error(`\n❌ DEPOSIT ERROR: ${errorMsg}`)
    showError(`Deposit failed: ${errorMsg}`)
    throw error
  }
}

/**
 * Record deposit in backend database (for link tracking)
 * This is non-critical - the deposit has already succeeded on-chain
 */
async function recordDepositInBackend(params: {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  transactionSignature: string
}): Promise<void> {
  const url = `${CONFIG.BACKEND_URL}/api/deposit/record`
  
  console.log(`   📤 Recording deposit with backend...`)
  console.log(`      URL: ${url}`)
  console.log(`      LinkID: ${params.linkId}`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId: params.linkId,
      amount: params.amount,
      lamports: params.lamports,
      publicKey: params.publicKey,
      transactionHash: params.transactionSignature
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error(`      ❌ Backend error (${response.status}):`, errorData)
    throw new Error(errorData.error || `Backend error: ${response.status}`)
  }
  
  const result = await response.json()
  console.log(`      ✅ Deposit recorded:`, result)
}

/**
 * Legacy function - kept for backwards compatibility
 * Redirects to the new non-custodial flow
 * @deprecated Use executeUserPaysDeposit instead
 */
export async function executeDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  return executeUserPaysDeposit(request, wallet)
}
