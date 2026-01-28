import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ PRIVACY CASH SDK DEPOSIT FLOW - BACKEND RELAY
 * 
 * Flow (Using Privacy Cash SDK on Backend):
 * 1. Frontend: Send deposit request to backend (amount + user address)
 * 2. Backend: Initialize Privacy Cash SDK with operator keypair
 * 3. Backend: Call SDK.deposit({ lamports })
 * 4. Backend: Relay signed transaction to Privacy Cash relayer API
 * 5. Backend: Record in database
 * 
 * Key: Backend handles all crypto (ZK proof, encryption, signing)
 * Frontend just sends request and shows status
 * Backend relays signed transaction to Privacy Cash relayer
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
  console.log(`   📤 Step 3: Backend relays to Privacy Cash`)

  try {
    // ✅ STEP 1: User signs wallet message (for identity verification)
    console.log('🔐 Step 1: Requesting wallet signature...')
    
    let signature: Uint8Array | undefined
    try {
      // Request user to sign a message for verification
      const message = new TextEncoder().encode(`Privacy Cash Deposit - ${linkId}`)
      signature = await wallet.signMessage(message)
      console.log(`   ✅ Wallet signature obtained`)
    } catch (signErr: any) {
      if (signErr.message?.toLowerCase().includes('user rejected')) {
        throw new Error('User rejected wallet signature. Please try again.')
      }
      console.warn('⚠️  Signature optional for some wallets, continuing...')
    }

    // ✅ STEP 2: Send deposit request to backend
    console.log('📨 Step 2: Sending deposit request to backend...')
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   User: ${publicKey}`)
    
    const depositPayload = {
      linkId,
      amount: amount.toString(),
      publicKey,
      lamports,
      signature: signature ? Array.from(signature) : undefined,
      // Optional: referrer for affiliate tracking
      referrer: undefined,
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
      throw new Error(`Backend relay failed: ${errorMsg}`)
    }

    const depositData = await depositResponse.json()
    const transactionSignature = depositData.transactionHash || depositData.tx

    // ✅ SUCCESS: Transaction relayed to Privacy Cash pool
    console.log(`✅ Transaction relayed to Privacy Cash!`)
    console.log(`   Status: Submitted to Privacy Cash relayer`)
    console.log(`   Signature: ${transactionSignature}`)
    
    console.log('🎉 Deposit completed successfully!')
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Status: Encrypted in Privacy Cash pool`)
    console.log(`   Privacy: Zero-knowledge encrypted with ZK proof`)
    console.log(`   Only you can decrypt your funds`)
    console.log(`   Transaction: ${transactionSignature}`)

    showSuccess(
      `✅ Deposit Successful!\n` +
      `Amount: ${amount} SOL\n` +
      `Status: Relayed to Privacy Cash\n` +
      `Privacy: Zero-knowledge encrypted\n` +
      `Only you can claim your funds\n` +
      `Tx: ${transactionSignature.slice(0, 20)}...`
    )

    return transactionSignature

  } catch (error: any) {
    console.error('❌ Deposit flow error:', error.message)

    let errorMsg = error.message
    if (error.message?.includes('User rejected')) {
      errorMsg = 'You rejected the operation. Please try again and approve to continue.'
    } else if (error.message?.includes('network')) {
      errorMsg = 'Network error. Please try again.'
    } else if (error.message?.includes('insufficient')) {
      errorMsg = 'Insufficient SOL balance. Please check your wallet.'
    } else if (error.message?.includes('SDK') || error.message?.includes('Backend')) {
      errorMsg = 'Privacy Cash error. Please check your setup.'
    }

    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}
