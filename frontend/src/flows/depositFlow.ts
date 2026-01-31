import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { executeNonCustodialDeposit, WalletAdapter } from '../services/browserDeposit'
import { encryptUtxoPrivateKey } from '../utils/encryptionHelper'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
  recipientAddress?: string  // ✅ Recipient wallet - Privacy Cash binds UTXO to them
  token?: string  // ✅ Token type: "SOL", "USDC", "USDT", etc. (defaults to "SOL")
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
  const { linkId, amount, publicKey, recipientAddress, token } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('\n💰 Processing NON-CUSTODIAL deposit...')
  console.log(`   Sender: ${publicKey}`)
  console.log(`   Token: ${token || 'SOL'}`)
  if (recipientAddress) {
    console.log(`   Recipient: ${recipientAddress}`)
  }
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
    // ✅ Pass recipient so Privacy Cash SDK binds UTXO to recipient's encryption key
    const result = await executeNonCustodialDeposit({
      wallet: walletAdapter,
      lamports,
      connection,
      recipientAddress,  // ✅ Pass recipient for Privacy Cash to encrypt UTXO for them
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

      // If we managed to extract UTXO private key, encrypt it with the linkId and store it
      if (result.utxoPrivateKey) {
        try {
          console.log('🔐 Encrypting and storing UTXO private key...')
          const { encryptedUtxoPrivateKey, iv } = await encryptUtxoPrivateKey(result.utxoPrivateKey, linkId)

          const storeRes = await fetch(`${CONFIG.BACKEND_URL}/api/deposit/store-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkId, encryptedUtxoPrivateKey, iv })
          })

          if (!storeRes.ok) {
            const errBody = await storeRes.json().catch(() => ({ error: 'unknown' }))
            console.warn('Failed to store encrypted key:', errBody)
          } else {
            console.log('✅ Encrypted key stored successfully')
          }
        } catch (err: any) {
          console.warn('Failed to encrypt-or-store UTXO key:', err.message || err)
        }
      }

    } catch (recordErr: any) {
      // Non-critical - deposit succeeded even if recording fails
      console.error('❌ Failed to record deposit in backend:', recordErr.message || recordErr)
      console.warn('   ⚠️  Your deposit is safe on Privacy Cash, but link tracking failed.')
      console.warn('   ⚠️  You may need to manually record this transaction.')
    }

    console.log(`\n✅ DEPOSIT SUCCESSFUL`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Transaction: ${result.transactionSignature}`)
    console.log(`   Status: Funds in Privacy Cash pool ✨`)

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
  
  try {
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
      
      // If primary endpoint fails, try fallback endpoint
      if (response.status === 404) {
        console.warn(`      ⚠️  Primary endpoint not found, trying fallback...`)
        await recordDepositWithFallback(params)
        return
      }
      
      throw new Error(errorData.error || `Backend error: ${response.status}`)
    }
    
    const result = await response.json()
    console.log(`      ✅ Deposit recorded:`, result)
  } catch (primaryErr) {
    console.error(`      ❌ Primary endpoint failed:`, primaryErr)
    console.warn(`      🔄 Attempting fallback endpoint...`)
    await recordDepositWithFallback(params)
  }
}

/**
 * Fallback endpoint for recording deposits
 * Used if primary /api/deposit/record endpoint fails
 */
async function recordDepositWithFallback(params: {
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  transactionSignature: string
}): Promise<void> {
  const url = `${CONFIG.BACKEND_URL}/api/deposit/verify-and-record`
  
  console.log(`      Fallback URL: ${url}`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId: params.linkId,
      transactionHash: params.transactionSignature,
      publicKey: params.publicKey
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error(`      ❌ Fallback endpoint error (${response.status}):`, errorData)
    throw new Error(errorData.error || `Fallback error: ${response.status}`)
  }
  
  const result = await response.json()
  console.log(`      ✅ Deposit recorded (via fallback):`, result)
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

/**
 * Manual deposit recording for recovery
 * Use this when:
 * - Deposit succeeded on-chain (visible on Solscan)
 * - But backend recording failed
 * - User has the transaction hash from Solscan
 * 
 * @param linkId - The payment link ID
 * @param transactionHash - Transaction hash from Solscan
 * @param lamports - Amount in lamports (optional, will use link's original amount if not provided)
 */
export async function manuallyRecordDeposit(
  linkId: string,
  transactionHash: string,
  lamports?: number
): Promise<boolean> {
  const url = `${CONFIG.BACKEND_URL}/api/deposit/manual-record`
  
  console.log(`\n🔧 Manually recording deposit...`)
  console.log(`   Link: ${linkId}`)
  console.log(`   Tx: ${transactionHash?.slice(0, 20)}...`)
  if (lamports) {
    console.log(`   Amount: ${(lamports / 1e9).toFixed(6)} SOL (${lamports} lamports)`)
  }
  
  try {
    const body: any = {
      linkId,
      transactionHash
    }
    
    // Include lamports if provided
    if (lamports && lamports > 0) {
      body.lamports = lamports
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`❌ Manual recording failed:`, errorData)
      throw new Error(errorData.error || `Failed: ${response.status}`)
    }
    
    const result = await response.json()
    console.log(`✅ Deposit recorded successfully!`, result)
    return true
  } catch (error: any) {
    console.error(`❌ Manual recording error:`, error.message)
    return false
  }
}
