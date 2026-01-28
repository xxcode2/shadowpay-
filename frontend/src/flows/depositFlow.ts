import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { PrivacyCashService } from '../services/privacyCashService'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ PRIVACY CASH SDK DEPOSIT FLOW - USER SIGNS
 * 
 * Flow (Using Privacy Cash SDK with User's Wallet):
 * 1. Frontend: Initialize Privacy Cash SDK with USER's wallet adapter
 * 2. Frontend: Call SDK.deposit({ lamports })
 * 3. SDK handles: ZK proof generation, encrypted UTXOs, USER signs transaction
 * 4. Frontend: Gets signed transaction from SDK
 * 5. Frontend: Send signed transaction to backend for relay
 * 6. Backend: Relay to Privacy Cash relayer API
 * 7. Backend: Record in database
 * 
 * Key: USER's wallet signs the deposit (not operator!)
 * SDK handles all crypto with user's signing wallet
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
    // ✅ STEP 1: Initialize Privacy Cash SDK with USER's wallet
    console.log('📋 Step 1: Initializing Privacy Cash SDK with your wallet...')
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    
    let privacyCashClient: any
    try {
      // Initialize SDK with USER's wallet (not operator!)
      // The SDK will use wallet.signTransaction() for signing
      privacyCashClient = PrivacyCashService.getClientForUser(wallet, publicKey)
      console.log(`   ✅ SDK initialized with your wallet`)
    } catch (initError: any) {
      throw new Error('Failed to initialize Privacy Cash SDK: ' + initError.message)
    }

    // ✅ STEP 2: User's wallet signs the deposit transaction via SDK
    console.log('🔐 Step 2: Your wallet will sign the deposit transaction...')
    console.log(`   - Generating ZK proof`)
    console.log(`   - Creating encrypted UTXOs`)
    console.log(`   - Waiting for your wallet signature...`)
    
    let depositResult: any
    try {
      // Call Privacy Cash SDK deposit with user's wallet
      // This will trigger wallet signature request (Phantom, Magic, etc)
      depositResult = await privacyCashClient.deposit({
        lamports,
      })
      console.log(`   ✅ Transaction signed by YOUR wallet`)
    } catch (sdkErr: any) {
      if (sdkErr.message?.toLowerCase().includes('user rejected')) {
        throw new Error('You rejected the wallet signature. Please try again.')
      }
      throw new Error('Privacy Cash SDK deposit failed: ' + sdkErr.message)
    }

    const signedTransaction = depositResult.tx
    if (!signedTransaction) {
      throw new Error('SDK did not return signed transaction')
    }

    // ✅ STEP 3: Send signed transaction to backend for relay
    console.log('📨 Step 3: Sending signed transaction to backend...')
    console.log(`   - Backend will relay to Privacy Cash relayer`)
    console.log(`   - Transaction already signed by YOUR wallet`)
    
    const depositPayload = {
      linkId,
      signedTransaction,
      amount: amount.toString(),
      publicKey,
      lamports,
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
    console.log(`✅ Deposit successful!`)
    console.log(`   Status: Signed by YOUR wallet and relayed to Privacy Cash`)
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
      `Status: Signed by YOUR wallet\n` +
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
    } else if (error.message?.includes('SDK') || error.message?.includes('Backend')) {
      errorMsg = 'Privacy Cash error. Please check your setup.'
    }

    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}
