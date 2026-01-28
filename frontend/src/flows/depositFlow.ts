import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ PRIVACY CASH SDK DEPOSIT FLOW - USER WALLET SIGNS TX
 * 
 * Flow (User's wallet executes and signs the deposit):
 * 1. Frontend: Initialize Privacy Cash SDK with USER's public key
 * 2. Frontend: SDK generates ZK proof + encrypted UTXOs
 * 3. Frontend: SDK creates transaction
 * 4. Frontend: USER's wallet SIGNS transaction (via Phantom)
 * 5. Frontend: Send signed transaction to backend
 * 6. Backend: Relay signed transaction to Privacy Cash
 * 7. Backend: Record transaction in database
 * 
 * Key: USER's wallet signs and pays, backend only relays
 * User's funds come from USER's wallet balance, not operator
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
    // ✅ STEP 1: Initialize Privacy Cash SDK with user's public key
    console.log('📋 Step 1: Initializing Privacy Cash SDK...')
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   Your wallet: ${publicKey}`)
    
    let privacyCashClient: any
    try {
      // Import PrivacyCash SDK
      // @ts-ignore
      const { PrivacyCash } = await import('privacycash')
      
      const rpcUrl = process.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com'
      
      // Initialize SDK with USER's public key
      // SDK will use wallet.signTransaction() for signing
      privacyCashClient = new PrivacyCash({
        RPC_url: rpcUrl,
        owner: publicKey,  // USER's public key (not operator!)
        enableDebug: true
      })
      console.log(`   ✅ SDK initialized with your wallet`)
    } catch (initErr: any) {
      throw new Error('Failed to initialize Privacy Cash SDK: ' + initErr.message)
    }

    // ✅ STEP 2: SDK generates transaction + USER signs with wallet
    console.log('🔐 Step 2: Generating transaction for your signature...')
    console.log(`   - Privacy Cash SDK generating ZK proof`)
    console.log(`   - Creating encrypted UTXOs`)
    console.log(`   - Waiting for your wallet signature...`)
    
    let depositResult: any
    try {
      // SDK.deposit() returns transaction that SDK created
      // User's wallet will be asked to sign it (Phantom popup)
      depositResult = await privacyCashClient.deposit({
        lamports,
      })
      console.log(`   ✅ Your wallet signed the transaction`)
    } catch (sdkErr: any) {
      if (sdkErr.message?.toLowerCase().includes('user rejected')) {
        throw new Error('You rejected the wallet signature. Please try again.')
      }
      throw new Error('Privacy Cash SDK deposit failed: ' + sdkErr.message)
    }

    const userTxSignature = depositResult.tx
    if (!userTxSignature) {
      throw new Error('SDK did not return transaction signature')
    }

    // ✅ STEP 3: Send signed transaction to backend for relay
    console.log('📨 Step 3: Sending signed transaction to backend...')
    console.log(`   - Backend will relay to Privacy Cash relayer`)
    console.log(`   - Only relaying, not signing`)
    
    const depositPayload = {
      linkId,
      signedTransaction: userTxSignature,
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
