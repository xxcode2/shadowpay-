import { PrivacyCashService } from '../services/privacyCashService'
import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * Main deposit flow - USER PAYS VERSION
 * 
 * Step 1: Derive encryption key by signing message
 * Step 2: Request backend to build deposit instruction
 * Step 3: User signs the transaction with their wallet ✅ USER SIGNS HERE
 * Step 4: Submit signed transaction to blockchain
 * Step 5: Record deposit in backend database
 */
export async function executeRealDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)
  
  console.log('🔐 Starting deposit flow...')
  console.log(`   Link: ${linkId}`)
  console.log(`   User: ${publicKey}`)
  console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
  console.log(`   ✅ User will sign and pay from their wallet`)
  
  try {
    // ✅ STEP 1: Derive encryption key by signing message
    console.log('📝 Step 1: Deriving encryption key by signing off-chain message...')
    
    try {
      const encryptionKey = await PrivacyCashService.deriveEncryptionKey(wallet)
      console.log(`✅ Encryption key derived`)
      console.log(`   Key: ${encryptionKey}`)
    } catch (keyErr: any) {
      console.warn('⚠️  Encryption key derivation failed (non-critical):', keyErr.message)
      // Non-critical - continue anyway
    }
    
    // ✅ STEP 2: Request backend to build deposit instruction
    console.log('🏗️  Step 2: Requesting backend to build deposit instruction...')
    
    const config = CONFIG
    const buildResponse = await fetch(
      `${config.BACKEND_URL}/api/deposit/build-instruction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          amount,
          lamports,
          publicKey,
        }),
      }
    )
    
    if (!buildResponse.ok) {
      const error = await buildResponse.json()
      throw new Error(`Failed to build deposit instruction: ${error.error}`)
    }
    
    const buildData = await buildResponse.json()
    console.log(`✅ Deposit instruction built`)
    console.log(`   Transaction ready for user signature`)
    console.log(`   Message: ${buildData.message}`)
    
    // ✅ STEP 3: User signs the transaction with their wallet
    console.log('🔐 Step 3: Requesting user to sign transaction with wallet...')
    
    // Deserialize transaction from base64
    const { Transaction } = await import('@solana/web3.js')
    const transactionBuffer = Buffer.from(buildData.transaction, 'base64')
    const transaction = Transaction.from(transactionBuffer)
    
    console.log(`   Transaction deserialized`)
    console.log(`   Fee payer: ${transaction.feePayer?.toString()}`)
    
    // Sign transaction with wallet - USER SIGNS HERE!
    if (!wallet.signTransaction) {
      throw new Error('Wallet does not support transaction signing')
    }
    
    const signedTransaction = await wallet.signTransaction(transaction)
    console.log(`✅ Transaction signed by user`)
    console.log(`   Signatures: ${signedTransaction.signatures.length}`)
    
    // Serialize signed transaction to base64
    const signedTransactionBuffer = signedTransaction.serialize()
    const signedTransactionBase64 = signedTransactionBuffer.toString('base64')
    
    // ✅ STEP 4: Submit signed transaction to blockchain
    console.log('📤 Step 4: Submitting signed transaction to blockchain...')
    
    // Create connection and send transaction
    const { Connection } = await import('@solana/web3.js')
    const RPC_URL = CONFIG.SOLANA_RPC_URL
    const connection = new Connection(RPC_URL, 'confirmed')
    
    // Send raw transaction
    const transactionSignature = await connection.sendRawTransaction(
      signedTransactionBuffer,
      {
        skipPreflight: false,
        maxRetries: 5,
      }
    )
    
    console.log(`✅ Transaction submitted to blockchain`)
    console.log(`   Signature: ${transactionSignature}`)
    
    // Wait for confirmation
    console.log('⏳ Waiting for transaction confirmation...')
    const confirmation = await connection.confirmTransaction(
      transactionSignature,
      'confirmed'
    )
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`)
    }
    
    console.log(`✅ Transaction confirmed on blockchain`)
    
    // ✅ STEP 5: Record deposit in backend
    console.log('📝 Step 5: Recording deposit in backend database...')
    
    const recordResponse = await fetch(
      `${config.BACKEND_URL}/api/deposit/record`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          depositTx: transactionSignature,
          amount,
          publicKey,
        }),
      }
    )
    
    if (!recordResponse.ok) {
      const error = await recordResponse.json()
      console.warn(`⚠️  Recording in backend failed: ${error.error}`)
      // Still show success since transaction is on-chain
    } else {
      const recordData = await recordResponse.json()
      console.log(`✅ Deposit recorded in backend`)
      console.log(`   Message: ${recordData.message}`)
    }
    
    // ✅ SUCCESS
    console.log('🎉 Deposit completed successfully!')
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Transaction: ${transactionSignature}`)
    console.log(`   Explorer: https://solscan.io/tx/${transactionSignature}`)
    
    showSuccess(
      `✅ Deposit Successful!\n` +
      `Amount: ${amount} SOL\n` +
      `Transaction: ${transactionSignature}`
    )
    
    return transactionSignature
    
  } catch (error: any) {
    console.error('❌ Deposit flow error:', error.message)
    
    // Show detailed error
    let errorMsg = error.message
    if (error.message?.includes('User rejected')) {
      errorMsg = 'You rejected the transaction signature. Please try again and approve the signature.'
    } else if (error.message?.includes('insufficient')) {
      errorMsg = 'Insufficient SOL balance for this deposit.'
    }
    
    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}
