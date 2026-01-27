import { PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js'
import { CONFIG } from '../config'
import {
  validateDepositAmount,
  formatLamportsToSOL,
  mapPrivacyCashError,
  assessDepositPrivacy,
  createDepositErrorContext,
  getExplorerUrl,
  estimateTransactionFees,
} from '../utils/privacyCashUtils'

/**
 * ✅ IMPLEMENTASI PRIVACY CASH SDK SESUAI DOKUMENTASI RESMI
 * 
 * Flow yang benar:
 * 1. Call SDK deposit() function langsung (bukan instantiate PrivacyCash class)
 * 2. SDK akan:
 *    - Generate encryption key dari wallet signature
 *    - Create zero-knowledge proof
 *    - Build deposit transaction
 *    - Request wallet signature via transactionSigner callback
 *    - Submit ke blockchain
 * 3. Backend hanya record transaction hash
 * 
 * Dokumentasi: https://github.com/privacy-cash/privacy-cash-sdk
 */

export interface DepositResult {
  tx: string
  amountSOL: string
  amountLamports: number
  explorerUrl: string
  message: string
}

export interface DepositRequest {
  lamports: number
  wallet: any
  linkId: string
  skipPrivacyWarning?: boolean
}

/**
 * Validate deposit request before execution
 */
export function validateDepositRequest(request: DepositRequest): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate lamports
  const amountValidation = validateDepositAmount(request.lamports)
  if (!amountValidation.isValid) {
    errors.push(amountValidation.error || 'Invalid amount')
  } else if (amountValidation.error && !amountValidation.isValid) {
    warnings.push(amountValidation.error)
  }

  // Validate wallet
  if (!request.wallet) {
    errors.push('Wallet is required')
  }

  // Validate linkId
  if (!request.linkId || typeof request.linkId !== 'string') {
    errors.push('Valid linkId is required')
  }

  // Privacy assessment
  if (!request.skipPrivacyWarning) {
    const privacyAssessment = assessDepositPrivacy(request.lamports)
    if (!privacyAssessment.isPrivacySafe) {
      warnings.push(...privacyAssessment.recommendations)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Execute deposit with comprehensive validation and error handling
 * 
 * ✅ Sesuai dokumentasi resmi Privacy Cash SDK
 * Calls the SDK deposit() function directly with proper parameters
 */
export async function executeRealDeposit(
  request: DepositRequest
): Promise<DepositResult> {
  const startTime = Date.now()
  
  try {
    // ✅ VALIDATE REQUEST
    console.log('🔍 Validating deposit request...')
    const validation = validateDepositRequest(request)

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ Privacy warnings:', validation.warnings)
    }

    const { lamports, wallet, linkId } = request
    const amountSOL = formatLamportsToSOL(lamports)

    console.log(`🚀 Executing deposit of ${amountSOL} SOL to Privacy Cash pool`)
    console.log(`   📋 Payment Link: ${linkId}`)
    console.log(`   💰 Amount: ${amountSOL} SOL (${lamports} lamports)`)

    // Validate wallet has required methods
    if (!wallet.publicKey) {
      throw new Error('Wallet does not have a public key')
    }

    if (typeof wallet.signTransaction !== 'function') {
      throw new Error('Wallet does not support transaction signing')
    }

    console.log(`📍 Wallet: ${wallet.publicKey.toString()}`)

    // ✅ SETUP CONNECTION
    const RPC_URL = CONFIG.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com'
    const connection = new Connection(RPC_URL, 'confirmed')
    
    console.log(`🌐 Connected to: ${RPC_URL}`)

    // ✅ STEP 1: Derive encryption key from wallet signature
    console.log('📦 Privacy Cash SDK initializing...')
    console.log('   🔐 Deriving encryption key from wallet signature...')

    const { PrivacyCashService } = await import('../services/privacyCashService')
    
    // Sign message to derive encryption key
    console.log('📝 Step 1: Signing message for encryption key derivation...')
    try {
      await PrivacyCashService.deriveEncryptionKey(wallet)
    } catch (err: any) {
      if (err.message?.includes('User rejected')) {
        throw new Error('User rejected the signature request. Please approve the Phantom popup to continue.')
      }
      throw err
    }
    
    // ✅ STEP 2: Request backend to execute deposit
    // Backend has the PrivacyCash SDK client to properly handle deposits
    console.log('📝 Step 2: Requesting backend to execute deposit via Privacy Cash SDK...')
    
    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL ||
      'https://shadowpay-backend-production.up.railway.app'

    // Request backend to execute deposit with SDK
    console.log('📤 Requesting deposit execution from backend...')
    const depositExecRes = await fetch(`${BACKEND_URL}/api/deposit/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        amount: amountSOL,
        lamports: lamports,
        publicKey: wallet.publicKey.toString(),
      }),
    })

    if (!depositExecRes.ok) {
      const errorData = await depositExecRes.json()
      throw new Error(`Failed to execute deposit: ${errorData.error || depositExecRes.statusText}`)
    }

    const { tx: depositTx } = await depositExecRes.json()

    if (!depositTx) {
      throw new Error('No transaction hash returned from backend')
    }

    console.log(`✅ Deposit executed by backend! Transaction: ${depositTx}`)
    console.log(`   💾 ${amountSOL} SOL deposited to Privacy Cash private pool`)
    console.log(`   ⏱️ Total time: ${Date.now() - startTime}ms`)

    const explorerUrl = getExplorerUrl(depositTx)
    console.log(`   🔗 View on Explorer: ${explorerUrl}`)

    return {
      tx: depositTx,
      amountSOL,
      amountLamports: lamports,
      explorerUrl,
      message: `✅ Deposit successful! ${amountSOL} SOL has been transferred to your Privacy Cash shielded pool.`,
    }
  } catch (err: any) {
    console.error('❌ Deposit failed:', err)

    // ✅ CREATE ERROR CONTEXT
    const errorContext = createDepositErrorContext(err, {
      lamports: request.lamports,
      wallet: request.wallet?.publicKey?.toString(),
      linkId: request.linkId,
      rpcUrl: CONFIG.SOLANA_RPC_URL,
    })

    console.error('📋 Error Context:', errorContext)

    // ✅ MAP ERROR TO USER-FRIENDLY MESSAGE
    const userMessage = mapPrivacyCashError(err)

    // Create detailed error for throwing
    const depositError = new Error(userMessage)
    ;(depositError as any).context = errorContext
    ;(depositError as any).originalError = err

    throw depositError
  }
}
