import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ PRIVACY CASH DEPOSIT FLOW - USER SIGNS, BACKEND GENERATES PROOF
 * 
 * Flow:
 * 1. Frontend: Ask user to authorize with wallet signature
 * 2. Frontend: Send user's public key + authorization to backend
 * 3. Backend: Initialize Privacy Cash SDK with OPERATOR keypair
 * 4. Backend: SDK generates ZK proof + encrypted UTXOs using user's address
 * 5. Backend: Create transaction (user's wallet pays)
 * 6. Backend: Send transaction to frontend for user to sign
 * 7. Frontend: USER's wallet SIGNS transaction (via Phantom)
 * 8. Frontend: Send signed transaction back to backend
 * 9. Backend: Relay signed transaction to Privacy Cash
 * 10. Backend: Record transaction in database
 * 
 * Key: Backend generates proof, USER signs transaction, USER pays
 * User's funds come from USER's wallet balance, not operator
 */
export async function executeRealDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('💰 Processing payment...')
  console.log(`   📋 Step 1: Backend generates Privacy Cash proof`)
  console.log(`   🔐 Step 2: User signs transaction in wallet`)
  console.log(`   📤 Step 3: Backend relays to Privacy Cash`)

  try {
    // ✅ STEP 1: Request backend to generate ZK proof + transaction
    console.log('📋 Step 1: Requesting backend to generate Privacy Cash proof...')
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
    console.log(`   Your wallet: ${publicKey}`)
    console.log(`   - Backend initializes Privacy Cash SDK`)
    console.log(`   - SDK generates ZK proof`)
    console.log(`   - Creating encrypted UTXO with your address`)
    
    // Send to backend to generate the transaction
    const generatePayload = {
      linkId,
      publicKey,
      amount: amount.toString(),
      lamports,
    }

    const generateResponse = await fetch(
      `${CONFIG.BACKEND_URL}/api/deposit/prepare`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatePayload),
      }
    )

    if (!generateResponse.ok) {
      const error = await generateResponse.json()
      const errorMsg = error.details || error.error || generateResponse.statusText
      throw new Error(`Backend proof generation failed: ${errorMsg}`)
    }

    const generateData = await generateResponse.json()
    const unsignedTransaction = generateData.transaction
    
    if (!unsignedTransaction) {
      throw new Error('Backend did not return transaction to sign')
    }

    console.log(`   ✅ Backend generated transaction with ZK proof`)

    // ✅ STEP 2: User signs the transaction with Phantom
    console.log('🔐 Step 2: Signing transaction with your wallet...')
    console.log(`   - Phantom will ask you to sign`)
    console.log(`   - Review the transaction details`)
    
    let signedTxBase64: string
    try {
      // Parse the unsigned transaction from backend
      const txBuffer = Buffer.from(unsignedTransaction, 'base64')
      
      // Ask Phantom to sign it
      const { Transaction } = await import('@solana/web3.js')
      const transaction = Transaction.from(txBuffer)
      
      const signedTx = await wallet.signTransaction(transaction)
      
      // Serialize back to base64
      const serialized = signedTx.serialize()
      signedTxBase64 = serialized.toString('base64')
      
      console.log(`   ✅ Your wallet signed the transaction`)
    } catch (signErr: any) {
      if (signErr.message?.toLowerCase().includes('user rejected')) {
        throw new Error('You rejected the wallet signature. Please try again.')
      }
      throw new Error('Failed to sign transaction: ' + signErr.message)
    }

    // ✅ STEP 3: Send signed transaction to backend for relay
    console.log('📨 Step 3: Sending signed transaction to backend...')
    console.log(`   - Backend will relay to Privacy Cash relayer`)
    console.log(`   - Your funds are encrypted with ZK proof`)
    
    const depositPayload = {
      linkId,
      signedTransaction: signedTxBase64,
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
