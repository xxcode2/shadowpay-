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
 * ✅ BACKEND DELEGATION PATTERN:
 * Frontend creates payment record, then backend executes withdrawal
 * (same as claimLinkFlow)
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

    // ✅ BACKEND HANDLES THE SEND
    // Use the new /api/send endpoint for direct sends (not /api/withdraw which is for claiming)
    
    console.log(`\nStep 1: Requesting backend to execute send`)
    
    // ✅ Frontend signs a message to authorize this send
    console.log(`Step 1.5: Signing authorization message...`)
    const messageToSign = `Send ${amountNum} SOL to ${recipientAddress}`
    let signature: string | null = null
    
    if (!wallet) {
      console.error(`❌ Wallet not available`)
      throw new Error('Wallet not connected')
    }
    
    if (!wallet.signMessage) {
      console.error(`❌ Wallet does not support signMessage. Available methods:`, Object.keys(wallet))
      throw new Error('Wallet does not support message signing')
    }
    
    try {
      const messageBytes = new TextEncoder().encode(messageToSign)
      console.log(`   Signing message (${messageBytes.length} bytes)...`)
      
      const signatureResult = await wallet.signMessage(messageBytes)
      console.log(`   Signature result type: ${signatureResult?.constructor?.name || typeof signatureResult}`)
      
      // Handle both direct Uint8Array and {signature: Uint8Array} format
      let signatureBytes: Uint8Array
      if (signatureResult instanceof Uint8Array) {
        signatureBytes = signatureResult
        console.log(`   Format: Direct Uint8Array`)
      } else if (signatureResult && 'signature' in signatureResult) {
        signatureBytes = signatureResult.signature
        console.log(`   Format: {signature: Uint8Array}`)
      } else {
        throw new Error(`Unexpected signature format: ${JSON.stringify(signatureResult)}`)
      }
      
      // Convert Uint8Array to hex string
      signature = Array.from(signatureBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      console.log(`✅ Message signed successfully (${signature.length} chars)`)
    } catch (signErr: any) {
      console.error(`❌ Failed to sign message:`, signErr.message)
      console.error(`   Full error:`, signErr)
      throw signErr
    }
    
    const BACKEND_URL = CONFIG.BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'
    
    console.log(`📤 Sending to backend:`, {
      senderAddress,
      recipientAddress,
      amount: amountNum,
      signatureLength: signature?.length || 0
    })
    
    const res = await fetch(`${BACKEND_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderAddress: senderAddress,
        recipientAddress: recipientAddress,
        amount: amountNum,
        signature: signature,
      })
    })

    if (!res.ok) {
      let errorMsg = `Send failed with status ${res.status}`
      try {
        const contentType = res.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const errorData = await res.json()
          errorMsg = errorData.error || errorData.details || errorMsg
        }
      } catch {}
      throw new Error(errorMsg)
    }

    const data = await res.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Send failed on backend')
    }

    const txHash = data.transactionHash

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

  } catch (error: any) {
    const errorMsg = error.message || 'Send failed'
    console.error(`\n❌ SEND ERROR: ${errorMsg}`)
    showError(`Send failed: ${errorMsg}`)
    throw error
  }
}
