import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'
import { CONFIG } from '../config'
import {
  validateDepositAmount,
  validateSolanaAddress,
  formatLamportsToSOL,
  initializePrivacyCashClient,
  mapPrivacyCashError,
  assessDepositPrivacy,
  buildDepositDetails,
  createDepositErrorContext,
  getExplorerUrl,
  estimateTransactionFees,
} from '../utils/privacyCashUtils'

/**
 * ✅ IMPLEMENTASI PRIVACY CASH SDK SESUAI DOKUMENTASI RESMI
 * 
 * SDK menghandle:
 * ✅ User signature request untuk derivasi encryption key
 * ✅ Encryption dan privacy-preserving protocol
 * ✅ Direct deposit ke Privacy Cash shielded pool
 * ✅ Comprehensive validation dan error handling
 * 
 * Dokumentasi: https://privacycash.mintlify.app/sdk/overview-copied-1
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
    console.log(`   📊 Estimated Fees:`)
    const fees = estimateTransactionFees()
    console.log(`      - Network Fee: ${fees.networkFee} SOL`)
    console.log(`      - Protocol Fee: ${fees.protocolFee} SOL`)
    console.log(`   ⭐ Phantom popup: "Sign message: Privacy Money account sign in"`)

    // ✅ INITIALIZE PRIVACYCASH SDK
    console.log('🚀 Initializing Privacy Cash SDK...')
    const RPC_URL = CONFIG.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com'

    const pc = initializePrivacyCashClient(
      RPC_URL,
      wallet,
      import.meta.env.DEV
    )

    console.log('✅ Privacy Cash SDK initialized')
    console.log('   🔐 Waiting for wallet signature...')

    // ✅ EXECUTE DEPOSIT
    // SDK akan:
    // 1. Ask user to sign: "Privacy Money account sign in"
    // 2. Derive encryption key dari signature
    // 3. Create shielded deposit transaction
    // 4. Submit to blockchain
    console.log(`⏳ Creating deposit transaction (${amountSOL} SOL)...`)
    console.log(`   💬 Check Phantom popup for signature request`)

    const { tx } = await pc.deposit({ lamports })

    console.log(`✅ Deposit transaction confirmed! Transaction: ${tx}`)
    console.log(`   ${amountSOL} SOL transferred to Privacy Cash shielded pool`)
    console.log(`   ⏱️ Transaction created in ${Date.now() - startTime}ms`)

    // ✅ RECORD DEPOSIT DI BACKEND (HANYA RECORD, BUKAN EKSEKUSI)
    console.log(`📤 Recording deposit in backend...`)
    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL ||
      'https://shadowpay-backend-production.up.railway.app'

    const recordRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        depositTx: tx,
        amount: amountSOL,
        publicKey: wallet.publicKey?.toString() || wallet.toString(),
      }),
    })

    if (!recordRes.ok) {
      const errorData = await recordRes.json()
      throw new Error(`Backend recording error: ${errorData.error || recordRes.statusText}`)
    }

    console.log(`✅ Deposit recorded successfully in backend`)
    console.log(`   📝 Link: ${linkId}`)
    console.log(`   💾 Transaction Hash: ${tx}`)
    console.log(`   ⏱️ Total time: ${Date.now() - startTime}ms`)

    const explorerUrl = getExplorerUrl(tx)
    console.log(`   🔗 View on Explorer: ${explorerUrl}`)

    return {
      tx,
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
