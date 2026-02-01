/**
 * SEND TO USER FLOW
 * 
 * This flow handles sending already-deposited funds to another user privately.
 * 
 * BACKEND DELEGATION PATTERN:
 * - Frontend: Creates payment record
 * - Backend: Executes withdrawal using operator keypair
 * - Relayer: Verifies ZK proof and sends to recipient
 * 
 * Flow:
 * 1. Backend creates payment record with recipient bound
 * 2. Frontend requests backend to execute withdrawal
 * 3. Backend uses PrivacyCash SDK with operator keypair
 * 4. Backend confirms receipt
 */

import { PublicKey } from '@solana/web3.js'
import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

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
 * 
 * ✅ NON-CUSTODIAL PATTERN:
 * Frontend has access to encrypted UTXOs in local cache
 * Frontend creates withdrawal transaction with user's signature
 * Frontend submits directly to relayer
 * Backend just records the transaction
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
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      throw new Error('Invalid amount: must be greater than 0')
    }

    console.log(`\n📋 Validating parameters:`)
    console.log(`   Payment ID: ${paymentId}`)
    console.log(`   Amount: ${amountNum} SOL`)
    console.log(`   Recipient: ${recipientAddress}`)

    // ✅ IMPORT PRIVACY CASH SDK
    console.log(`\nStep 1: Loading Privacy Cash SDK...`)
    const privacycashUtils = await import('privacycash/utils') as any
    const { withdraw, EncryptionService } = privacycashUtils
    console.log(`✅ Privacy Cash SDK loaded`)

    // ✅ CREATE ENCRYPTION SERVICE
    console.log(`\nStep 1.5: Creating encryption service...`)
    // Get signature from wallet for encryption key derivation
    const messageToSign = new TextEncoder().encode(`Authorize withdrawal: ${amountNum} SOL to ${recipientAddress}`)
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

    // Create encryption service and derive key from signature
    const encryptionService = new EncryptionService()
    encryptionService.deriveEncryptionKeyFromSignature(signatureForEncryption)
    console.log(`✅ Encryption service created`)

    // ✅ CREATE WALLET ADAPTER FOR SDK
    console.log(`\nStep 2: Creating wallet adapter...`)
    const walletAdapter = {
      publicKey: new PublicKey(senderAddress),
      signTransaction: async (tx: any) => {
        console.log(`   Signing transaction...`)
        return await wallet.signTransaction(tx)
      },
      signAllTransactions: async (txs: any[]) => {
        console.log(`   Signing ${txs.length} transactions...`)
        return await wallet.signAllTransactions(txs)
      },
      signMessage: async (message: Uint8Array) => {
        console.log(`   Signing message (${message.length} bytes)...`)
        const result = await wallet.signMessage(message)
        // Handle both direct Uint8Array and {signature: Uint8Array} format
        if (result instanceof Uint8Array) {
          return result
        } else if (result && 'signature' in result) {
          return result.signature
        }
        return result
      }
    }
    console.log(`✅ Wallet adapter created`)

    // ✅ EXECUTE WITHDRAWAL DIRECTLY FROM FRONTEND
    console.log(`\nStep 3: Executing withdrawal from Privacy Cash pool...`)
    const lamports = Math.floor(amountNum * 1e9)
    
    try {
      const txResult = await withdraw(
        walletAdapter,
        lamports,
        new PublicKey(recipientAddress),
        encryptionService  // Pass the encryption service
      )
      
      console.log(`✅ Withdrawal transaction created`)
      console.log(`   TX Hash: ${txResult.tx}`)
      
      const txHash = txResult.tx

      // ✅ NOTIFY BACKEND OF SUCCESSFUL SEND
      console.log(`\nStep 4: Recording transaction on backend...`)
      const BACKEND_URL = CONFIG.BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'
      
      try {
        const recordRes = await fetch(`${BACKEND_URL}/api/send/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderAddress,
            recipientAddress,
            amount: amountNum,
            transactionHash: txHash,
            paymentId
          })
        })
        
        if (!recordRes.ok) {
          console.warn(`⚠️ Failed to record transaction on backend`)
          // Continue anyway - transaction was successful
        } else {
          console.log(`✅ Transaction recorded`)
        }
      } catch (recordErr) {
        console.warn(`⚠️ Backend record failed:`, recordErr)
        // Continue - transaction was already submitted to relayer
      }

      console.log(`\n✅ SEND SUCCESSFUL`)
      console.log(`   Payment ID: ${paymentId}`)
      console.log(`   Amount: ${amount} SOL`)
      console.log(`   To: ${recipientAddress}`)
      console.log(`   Transaction: ${txHash}`)
      console.log(`   Status: Payment delivered privately ✨`)

      showSuccess(`${amount} SOL sent privately to ${recipientAddress.slice(0, 8)}...`)

      return {
        success: true,
        transactionSignature: txHash,
        paymentId,
        amount: amountNum,
        recipientAddress
      }

    } catch (withdrawErr: any) {
      console.error(`❌ Withdrawal failed:`, withdrawErr.message)
      throw new Error(`Withdrawal failed: ${withdrawErr.message}`)
    }

  } catch (error: any) {
    const errorMsg = error.message || 'Send failed'
    console.error(`\n❌ SEND ERROR: ${errorMsg}`)
    showError(`Send failed: ${errorMsg}`)
    throw error
  }
}
