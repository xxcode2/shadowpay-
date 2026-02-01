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

    // ✅ BACKEND HANDLES THE WITHDRAWAL
    // The backend has the operator keypair and can properly initialize PrivacyCash
    // This matches the proven claimLinkFlow pattern
    
    console.log(`\nStep 1: Requesting backend to execute withdrawal`)
    
    const BACKEND_URL = CONFIG.BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'
    
    const res = await fetch(`${BACKEND_URL}/api/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId: paymentId,
        recipientAddress: recipientAddress,
      })
    })

    if (!res.ok) {
      let errorMsg = `Withdrawal failed with status ${res.status}`
      try {
        const contentType = res.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        }
      } catch {}
      throw new Error(errorMsg)
    }

    const data = await res.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Withdrawal failed on backend')
    }

    const txHash = data.withdrawalTx || data.withdrawTx

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
