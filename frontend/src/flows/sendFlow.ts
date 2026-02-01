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

    // Parse amount
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      throw new Error('Invalid amount: must be greater than 0')
    }
    const lamports = Math.round(amountNum * 1e9)

    console.log(`\nStep 1: Initializing Privacy Cash SDK`)
    console.log(`   RPC URL: ${rpcUrl}`)
    console.log(`   Wallet: ${publicKeyObj.toBase58()}`)
    console.log(`   Amount: ${amountNum} SOL (${lamports} lamports)`)

    // ✅ Import PrivacyCash class (not the low-level utils functions)
    // The PrivacyCash class has proper withdraw() method
    const { PrivacyCash } = await import('privacycash') as any
    
    if (!PrivacyCash) {
      throw new Error('Failed to import PrivacyCash class from privacycash package')
    }

    console.log(`\nStep 2: Creating PrivacyCash instance`)
    
    // ✅ PrivacyCash expects owner to be a wallet adapter with:
    // - publicKey (PublicKey object)
    // - signTransaction (function)
    // - signAllTransactions (function)
    // Phantom wallet object has all of these!
    const walletAdapter = {
      publicKey: publicKeyObj,
      signTransaction: async (tx: VersionedTransaction) => {
        return await wallet.signTransaction(tx)
      },
      signAllTransactions: async (txs: VersionedTransaction[]) => {
        return await wallet.signAllTransactions(txs)
      },
      signMessage: async (message: Uint8Array) => {
        return await wallet.signMessage(message)
      }
    }
    
    const pc = new PrivacyCash({
      RPC_url: rpcUrl,
      owner: walletAdapter as any,  // Pass the properly formatted wallet adapter
      enableDebug: true
    })
    console.log(`   ✅ PrivacyCash instance created`)

    console.log(`\nStep 3: Executing withdrawal from Privacy Cash pool`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log(`   ⏳ This may take 30-60 seconds for ZK proof generation...`)

    let result
    try {
      // ✅ Use the PrivacyCash instance's withdraw method
      // This is a high-level method that handles everything
      result = await pc.withdraw({
        lamports,
        recipientAddress: recipientAddress,
      })
      
      console.log(`\n   ✅ Withdrawal successful!`)
      console.log(`   TX: ${result.tx}`)
      
    } catch (pcErr: any) {
      console.error(`\n   ❌ PrivacyCash withdrawal failed:`)
      console.error(`   Error: ${pcErr.message}`)
      console.error(`   Stack: ${pcErr.stack}`)
      throw new Error(`PrivacyCash withdrawal error: ${pcErr.message}`)
    }

    console.log(`\n✅ SEND SUCCESSFUL`)
    console.log(`   Payment ID: ${paymentId}`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   To: ${recipientAddress}`)
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Status: Payment delivered privately ✨`)

    showSuccess(`${amount} SOL sent privately to ${recipientAddress.slice(0, 8)}...`)

    return {
      success: true,
      transactionSignature: result.tx,
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
