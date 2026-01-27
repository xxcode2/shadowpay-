import { PrivacyCashService } from '../services/privacyCashService'
import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * Main deposit flow - OPERATOR PAYS VERSION
 * 
 * Privacy Cash SDK requires IMMEDIATE execution (cannot be deferred for user signature)
 * So backend executes deposit using operator keypair
 * 
 * Step 1: Derive encryption key by signing message
 * Step 2: Request backend to EXECUTE deposit (not build)
 * Step 3: Backend executes via Privacy Cash SDK and returns signature
 * Step 4: Record transaction in database
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
  console.log(`   ℹ️  Backend will execute via operator keypair (Privacy Cash SDK requirement)`)
  
  try {
    // ✅ STEP 1: Derive encryption key by signing message
    console.log('📝 Step 1: Deriving encryption key by signing off-chain message...')
    
    try {
      const encryptionKey = await PrivacyCashService.deriveEncryptionKey(wallet)
      console.log(`✅ Encryption key derived`)
    } catch (keyErr: any) {
      console.warn('⚠️  Encryption key derivation failed (non-critical):', keyErr.message)
      // Non-critical - continue anyway
    }
    
    // ✅ STEP 2: Request backend to EXECUTE deposit
    // Privacy Cash SDK requires immediate execution - cannot be deferred
    console.log('📤 Step 2: Requesting backend to execute deposit...')
    console.log('   Backend will use Privacy Cash SDK to execute immediately')
    
    const config = CONFIG
    const executeResponse = await fetch(
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
    
    if (!executeResponse.ok) {
      const error = await executeResponse.json()
      throw new Error(`Backend error: ${error.error || error.details || executeResponse.statusText}`)
    }
    
    const executeData = await executeResponse.json()
    const transactionSignature = executeData.tx
    
    console.log(`✅ Deposit executed by backend!`)
    console.log(`   Signature: ${transactionSignature}`)
    console.log(`   Message: ${executeData.message}`)
    
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
    if (error.message?.includes('Blockhash')) {
      errorMsg = 'Transaction blockhash expired. Try again.'
    } else if (error.message?.includes('insufficient')) {
      errorMsg = 'Insufficient balance for this deposit.'
    }
    
    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}
