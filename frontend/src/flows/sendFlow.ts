/**
 * SEND TO USER FLOW
 * 
 * This flow handles sending already-deposited funds to another user privately.
 * 
 * Difference from Deposit:
 * - Deposit: User signs to DEPOSIT their own SOL to Privacy Cash pool
 * - Send: User signs to WITHDRAW from Privacy Cash and send to recipient
 * 
 * Flow:
 * 1. Backend creates payment record with recipient bound
 * 2. Frontend calls Privacy Cash SDK to withdraw + send
 * 3. Backend confirms receipt
 */

import { CONFIG } from '../config'
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { showError, showSuccess } from '../utils/notificationUtils'

const SIGN_MESSAGE = 'Privacy Money account sign in'

export interface SendToUserRequest {
  paymentId: string
  amount: string
  senderAddress: string
  recipientAddress: string
}

export interface SendResult {
  success: boolean
  transactionSignature: string
  paymentId: string
  amount: number
  recipientAddress: string
}

/**
 * Send deposited funds to another user
 * This withdraws from Privacy Cash pool and transfers to recipient
 */
export async function executeSendToUser(
  request: SendToUserRequest,
  wallet: any
): Promise<SendResult> {
  const { paymentId, amount, senderAddress, recipientAddress } = request

  console.log('\n🚀 SENDING PRIVATE PAYMENT')
  console.log(`   Payment ID: ${paymentId}`)
  console.log(`   Amount: ${amount} SOL`)
  console.log(`   From: ${senderAddress}`)
  console.log(`   To: ${recipientAddress}`)

  try {
    // Ensure PublicKey is proper type
    const publicKeyObj = wallet.publicKey instanceof PublicKey 
      ? wallet.publicKey 
      : new PublicKey(wallet.publicKey)

    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL ||
      'https://mainnet.helius-rpc.com'

    const connection = new Connection(rpcUrl)

    console.log(`Step 1: Sign message to authorize withdrawal`)
    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE)
    let signature: Uint8Array

    try {
      signature = await wallet.signMessage(encodedMessage)
      // Handle wallets that return { signature } object
      if ((signature as any).signature) {
        signature = (signature as any).signature
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rejected')) {
        throw new Error('You rejected the signature request. This is required for authorization.')
      }
      throw err
    }

    if (!(signature instanceof Uint8Array)) {
      throw new Error('Invalid signature format')
    }

    console.log(`Step 2: Initializing Privacy Cash withdrawal`)
    
    // Import Privacy Cash SDK
    const privacycashUtils = await import('privacycash/utils') as any
    const { EncryptionService, withdraw } = privacycashUtils

    // Create encryption service from signature
    const encryptionService = new EncryptionService()
    
    // ✅ Ensure signature is proper Uint8Array
    if (!(signature instanceof Uint8Array)) {
      throw new Error('Signature must be Uint8Array')
    }
    
    console.log(`   Deriving encryption key from signature (${signature.length} bytes)`)
    encryptionService.deriveEncryptionKeyFromSignature(signature)
    console.log(`   ✅ Encryption key derived`)

    // Initialize WASM
    console.log(`Step 3: Initializing WASM for ZK proof`)
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()
    console.log(`   ✅ WASM initialized`)

    // Parse amount
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      throw new Error('Invalid amount: must be greater than 0')
    }
    const lamports = Math.round(amountNum * 1e9)
    console.log(`   Amount: ${amountNum} SOL (${lamports} lamports)`)

    console.log(`Step 4: Generating ZK proof for withdrawal`)
    console.log(`   This may take 30-60 seconds...`)

    // Call Privacy Cash withdraw function with correct parameters
    console.log(`Step 5: Executing withdrawal from Privacy Cash pool`)
    console.log(`   Recipient: ${recipientAddress}`)
    
    const result = await withdraw({
      lightWasm,
      connection,
      amount_in_lamports: lamports,
      keyBasePath: '/circuits/transaction2',
      publicKey: publicKeyObj,
      toAddress: new PublicKey(recipientAddress),
      signer: async (tx: VersionedTransaction) => {
        console.log(`   📝 Please sign the withdrawal transaction in your wallet`)
        return await wallet.signTransaction(tx)
      },
      storage: localStorage,
      encryptionService
    })

    console.log(`\n✅ SEND SUCCESSFUL`)
    console.log(`   Payment ID: ${paymentId}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   To: ${recipientAddress}`)
    console.log(`   Transaction: ${result.transactionSignature}`)
    console.log(`   Status: Payment delivered privately ✨`)

    showSuccess(`${amount} SOL sent privately to ${recipientAddress.slice(0, 8)}... View on Solscan: ${result.explorerUrl}`)

    return {
      success: true,
      transactionSignature: result.transactionSignature,
      paymentId,
      amount: amountNum,
      recipientAddress
    }

  } catch (error: any) {
    const errorMsg = error.message || 'Send failed'
    console.error(`\n❌ SEND ERROR: ${errorMsg}`)
    showError(`Send failed: ${errorMsg}`)
    throw error
  }
}
