/**
 * ✅ WITHDRAW FLOW (CORRECTED)
 * 
 * Recipient withdraws from incoming private payment
 * 
 * CORRECT MODEL:
 * 1. User receives private payment (UTXO encrypted with their key)
 * 2. User clicks "Withdraw"  
 * 3. Frontend derives encryption key from user's signature
 * 4. Privacy Cash SDK finds UTXOs encrypted with that key
 * 5. User signs withdrawal transaction
 * 6. Funds transferred to user's wallet
 */

import { PublicKey, Connection, VersionedTransaction } from '@solana/web3.js'
import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

export interface WithdrawRequest {
  walletAddress: string
}

export interface WithdrawResult {
  success: boolean
  transactionSignature: string
  amount: number
  walletAddress: string
}

/**
 * Recipient withdraws from private payment
 */
export async function executeWithdraw(
  request: WithdrawRequest,
  wallet: any
): Promise<WithdrawResult> {
  const { walletAddress } = request

  console.log('\n💸 WITHDRAWING FROM PRIVATE PAYMENT')
  console.log(`   Wallet: ${walletAddress}`)

  try {
    // ✅ IMPORT PRIVACY CASH SDK
    console.log(`\nStep 1: Loading Privacy Cash SDK...`)
    const privacycashUtils = await import('privacycash/utils') as any
    const { withdraw, EncryptionService } = privacycashUtils
    console.log(`✅ Privacy Cash SDK loaded`)

    // ✅ CREATE ENCRYPTION SERVICE WITH USER'S KEY
    console.log(`\nStep 2: Deriving encryption key from your wallet...`)
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const messageToSign = new TextEncoder().encode(SIGN_MESSAGE)
    let signatureForEncryption: Uint8Array
    
    try {
      const signResult = await wallet.signMessage(messageToSign)
      if (signResult instanceof Uint8Array) {
        signatureForEncryption = signResult
      } else if (signResult && 'signature' in signResult) {
        signatureForEncryption = signResult.signature
      } else {
        throw new Error('Invalid signature format from wallet')
      }
    } catch (signErr: any) {
      throw new Error(`Failed to sign message: ${signErr.message}`)
    }

    const encryptionService = new EncryptionService()
    console.log(`[DEBUG] Deriving key from signature...`)
    encryptionService.deriveEncryptionKeyFromSignature(signatureForEncryption)
    console.log(`✅ Encryption key derived`)

    // ✅ INITIALIZE WASM
    console.log(`\nStep 3: Initializing WASM...`)
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()
    console.log(`✅ WASM initialized`)

    // ✅ SETUP CONNECTION
    console.log(`\nStep 4: Connecting to Solana...`)
    const SOLANA_RPC_URL = CONFIG.SOLANA_RPC_URL
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    console.log(`✅ Connected to ${SOLANA_RPC_URL.slice(0, 30)}...`)

    // ✅ CALL WITHDRAW
    console.log(`\nStep 5: Creating withdrawal transaction...`)
    console.log(`   🔍 Searching for UTXOs encrypted with your key...`)
    
    const txResult = await withdraw({
      publicKey: new PublicKey(walletAddress),
      recipient: new PublicKey(walletAddress),
      encryptionService,
      lightWasm,
      connection,
      keyBasePath: '/circuits/transaction2',
      transactionSigner: async (tx: VersionedTransaction) => {
        console.log(`\n🔐 Signing with your wallet...`)
        const signed = await wallet.signTransaction(tx)
        console.log(`✅ Signed`)
        return signed
      },
      storage: localStorage
    })

    if (!txResult || !txResult.tx) {
      throw new Error('No transaction returned')
    }

    const txHash = txResult.tx

    console.log(`\n✅ WITHDRAWAL SUCCESSFUL`)
    console.log(`   Transaction: ${txHash}`)
    console.log(`   Status: Funds in your wallet ✨`)

    showSuccess(`Withdrawn to ${walletAddress.slice(0, 8)}...`)

    return {
      success: true,
      transactionSignature: txHash,
      amount: 0,
      walletAddress
    }

  } catch (error: any) {
    const errorMsg = error.message || 'Withdrawal failed'
    console.error(`\n❌ ERROR: ${errorMsg}`)
    
    if (errorMsg.includes('0 total UTXOs') || errorMsg.includes('no unspent UTXO')) {
      console.error(`\n💡 No UTXOs found:`)
      console.error(`   - No incoming payments`)
      console.error(`   - Already withdrawn`)
      console.error(`   - Different wallet`)
    }
    
    showError(`Withdrawal failed: ${errorMsg}`)
    throw error
  }
}

/**
 * Get incoming payments for wallet
 */
export async function getIncomingPayments(walletAddress: string): Promise<any[]> {
  try {
    const BACKEND_URL = CONFIG.BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'
    const res = await fetch(`${BACKEND_URL}/api/incoming/${walletAddress}`)
    
    if (!res.ok) return []
    
    const data = await res.json()
    return data.incoming || data || []
  } catch (err) {
    console.error('Error fetching incoming:', err)
    return []
  }
}
