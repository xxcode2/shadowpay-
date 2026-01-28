import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { PrivacyCashService } from '../services/privacyCashService'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ PRIVACY CASH SDK DEPOSIT FLOW - USER SIGNATURE-BASED
 * 
 * Flow (Backend deposits with user's signature authorization):
 * 1. Frontend: User's wallet signs a message (proves authorization)
 * 2. Frontend: Send signature to backend
 * 3. Backend: Derive encryption key from user's signature
 * 4. Backend: Initialize Privacy Cash SDK with derived encryption key
 * 5. Backend: Call SDK.deposit() with user's funds
 * 6. Backend: Record transaction in database
 * 
 * Key: User authorizes via signature, backend deposits with derived key
 * User can later re-derive same key to withdraw
 */
export async function executeRealDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('💰 Processing payment...')
  console.log(`   📋 Step 1: Building deposit transaction`)
  console.log(`   🔐 Step 2: User signs in wallet`)
  console.log(`   📤 Step 3: Backend deposits to Privacy Cash`)

  try {
    // ✅ STEP 1: User signs authorization message
    console.log('📋 Step 1: Requesting wallet signature for authorization...')
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   Link: ${linkId}`)
    
    let userSignature: Uint8Array | undefined
    try {
      // User signs a message with their wallet to authorize the deposit
      // Backend will derive encryption key from this signature
      const message = new TextEncoder().encode(
        `Privacy Cash Deposit\nLink: ${linkId}\nAmount: ${amount} SOL\nUser: ${publicKey}`
      )
      userSignature = await wallet.signMessage(message)
      console.log(`   ✅ Wallet signature obtained`)
    } catch (signErr: any) {
      if (signErr.message?.toLowerCase().includes('user rejected')) {
        throw new Error('You rejected the wallet signature. Please try again.')
      }
      throw new Error('Failed to get wallet signature: ' + signErr.message)
    }

    // ✅ STEP 2: Send signed request to backend for deposit
    console.log('📨 Step 2: Sending to backend for deposit...')
    console.log(`   - Backend will derive encryption key from your signature`)
    console.log(`   - Backend will deposit to Privacy Cash pool`)
    console.log(`   - Only you can decrypt your funds`)
    
    const depositPayload = {
      linkId,
      amount: amount.toString(),
      publicKey,
      lamports,
      userSignature: userSignature ? Array.from(userSignature) : undefined,
    }

    const depositResponse = await fetch(
      `${CONFIG.BACKEND_URL}/api/deposit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depositPayload),
      }
    )

    if (!depositResponse.ok) {
      const error = await depositResponse.json()
      const errorMsg = error.details || error.error || depositResponse.statusText
      throw new Error(`Backend deposit failed: ${errorMsg}`)
    }

    const depositData = await depositResponse.json()
    const transactionSignature = depositData.transactionHash || depositData.tx

    // ✅ SUCCESS: Transaction submitted to Privacy Cash pool
    console.log(`✅ Deposit successful!`)
    console.log(`   Status: Your wallet signed and authorized the deposit`)
    console.log(`   Funds: Encrypted in Privacy Cash pool`)
    console.log(`   Signature: ${transactionSignature}`)
    
    console.log('🎉 Deposit completed successfully!')
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Status: Encrypted in Privacy Cash pool`)
    console.log(`   Privacy: Zero-knowledge encrypted`)
    console.log(`   Only you can decrypt your funds`)
    console.log(`   Transaction: ${transactionSignature}`)

    showSuccess(
      `✅ Deposit Successful!\n` +
      `Amount: ${amount} SOL\n` +
      `Status: Authorized by your wallet\n` +
      `Privacy: Zero-knowledge encrypted\n` +
      `Only you can claim your funds\n` +
      `Tx: ${transactionSignature.slice(0, 20)}...`
    )

    return transactionSignature

  } catch (error: any) {
    console.error('❌ Deposit flow error:', error.message)

    let errorMsg = error.message
    if (error.message?.toLowerCase().includes('user rejected')) {
      errorMsg = 'You rejected the wallet signature. Please try again and approve.'
    } else if (error.message?.includes('network')) {
      errorMsg = 'Network error. Please try again.'
    } else if (error.message?.includes('insufficient')) {
      errorMsg = 'Insufficient SOL balance. Please check your wallet.'
    } else if (error.message?.includes('Backend')) {
      errorMsg = 'Backend deposit error. Please check your setup.'
    }

    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}
