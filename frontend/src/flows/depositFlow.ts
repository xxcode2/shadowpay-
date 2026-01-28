import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { PrivacyCashService } from '../services/privacyCashService'
import BN from 'bn.js'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ PRIVACY CASH SDK DEPOSIT FLOW (CORRECT)
 * 
 * Flow (Using Privacy Cash SDK):
 * 1. Frontend: Initialize Privacy Cash SDK client
 * 2. Frontend: Call client.deposit({ lamports })
 * 3. SDK handles: ZK proof generation, UTXO encryption, transaction signing
 * 4. Frontend: Get signedTransaction from SDK response
 * 5. Frontend: Send signedTransaction to backend
 * 6. Backend: Relay to Privacy Cash relayer API
 * 7. Backend: Record in database
 * 
 * Key: SDK handles ALL the complex crypto (ZK proof, encryption, signing)
 * Frontend just calls SDK and relays the result
 * Backend relays signed transaction to Privacy Cash relayer
 */
export async function executeRealDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('🔐 Starting Privacy Cash SDK deposit flow...')
  console.log(`   Link: ${linkId}`)
  console.log(`   User: ${publicKey}`)
  console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)

  try {
    // ✅ STEP 1: Initialize Privacy Cash SDK with circuit files and wallet
    console.log('📋 Step 1: Initializing Privacy Cash SDK client...')
    console.log(`   Loading circuit files from available sources`)
    
    // Use Helius RPC if available, otherwise fallback to Solana RPC
    const rpcUrl = process.env.VITE_RPC_URL || undefined
    if (rpcUrl) {
      console.log(`   Using custom RPC: ${rpcUrl.substring(0, 50)}...`)
    }
    
    // Initialize client with wallet (async to load circuit files)
    let privacyCashClient: any
    try {
      // Pass wallet to initializeClient so SDK can sign transactions
      privacyCashClient = await PrivacyCashService.initializeClient(wallet, rpcUrl)
      console.log(`   ✅ SDK client ready with ZK circuits and wallet`)
    } catch (initError: any) {
      throw new Error('Failed to initialize Privacy Cash SDK: ' + initError.message)
    }

    // ✅ STEP 2: Use Privacy Cash SDK to create signed transaction
    // SDK handles: ZK proof generation, UTXO encryption, transaction creation, signing
    console.log('🔐 Step 2: Privacy Cash SDK generating signed transaction...')
    console.log(`   - Generating ZK proof`)
    console.log(`   - Creating encrypted UTXOs`)
    console.log(`   - Building transaction`)
    console.log(`   - Signing with user key`)
    
    let signedTxResponse: any
    try {
      // Call Privacy Cash SDK deposit function
      // This returns a signed transaction ready to relay
      signedTxResponse = await privacyCashClient.deposit({ 
        lamports,
      })
      console.log(`   ✅ Transaction signed by Privacy Cash SDK`)
    } catch (sdkErr: any) {
      throw new Error('Privacy Cash SDK deposit failed: ' + sdkErr.message)
    }

    const signedTransaction = signedTxResponse.tx || signedTxResponse.signature
    if (!signedTransaction || typeof signedTransaction !== 'string') {
      throw new Error('SDK did not return signed transaction')
    }

    // ✅ STEP 3: Send signed transaction to backend for relay
    console.log('📨 Step 3: Sending signed transaction to backend...')
    console.log(`   - Backend will relay to Privacy Cash relayer`)
    console.log(`   - Relayer will submit to Solana`)
    
    const depositPayload = {
      linkId,
      signedTransaction,
      amount: amount.toString(),
      publicKey,
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
    const transactionSignature = depositData.transactionHash || depositData.tx || signedTransaction

    // ✅ SUCCESS: Transaction relayed to Privacy Cash pool
    console.log(`✅ Transaction relayed to Privacy Cash!`)
    console.log(`   Status: Submitted to Privacy Cash relayer`)
    console.log(`   Signature: ${transactionSignature}`)
    
    console.log('🎉 Deposit completed successfully!')
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Status: Encrypted in Privacy Cash pool`)
    console.log(`   Privacy: End-to-end encrypted with ZK proof`)
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
    } else if (error.message?.includes('SDK')) {
      errorMsg = 'Privacy Cash SDK error. Please check your setup.'
    }

    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}
