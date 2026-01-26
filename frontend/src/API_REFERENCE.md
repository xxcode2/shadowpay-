/**
 * Privacy Cash SDK API Reference
 * Complete API documentation for Privacy Cash SDK integration in ShadowPay
 */

// ============================================================================
// DEPOSIT FUNCTIONS
// ============================================================================

/**
 * Execute a deposit to the Privacy Cash shielded pool
 * 
 * @function executeRealDeposit
 * @param {DepositRequest} request - Deposit request configuration
 * @returns {Promise<DepositResult>} - Deposit result with transaction details
 * 
 * @example
 * import { executeRealDeposit } from './flows/depositFlow'
 * 
 * const result = await executeRealDeposit({
 *   lamports: 100_000_000,  // 0.1 SOL
 *   wallet: walletAdapter,
 *   linkId: 'payment-link-123'
 * })
 * 
 * console.log('Transaction:', result.tx)
 * console.log('Amount:', result.amountSOL, 'SOL')
 * console.log('Explorer:', result.explorerUrl)
 */

interface DepositRequest {
  /** Amount to deposit in lamports (1 SOL = 1,000,000,000 lamports) */
  lamports: number
  
  /** Wallet adapter or keypair (must support signing) */
  wallet: any
  
  /** Payment link ID to associate with this deposit */
  linkId: string
  
  /** Skip privacy assessment warnings (optional) */
  skipPrivacyWarning?: boolean
}

interface DepositResult {
  /** Transaction signature on Solana blockchain */
  tx: string
  
  /** Deposit amount in SOL (formatted string) */
  amountSOL: string
  
  /** Deposit amount in lamports (raw value) */
  amountLamports: number
  
  /** Solana Explorer URL for this transaction */
  explorerUrl: string
  
  /** User-friendly success message */
  message: string
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate deposit request before execution
 * 
 * @function validateDepositRequest
 * @param {DepositRequest} request - Deposit request to validate
 * @returns {Object} Validation result with errors and warnings
 * 
 * @example
 * const validation = validateDepositRequest({
 *   lamports: 100_000_000,
 *   wallet: walletAdapter,
 *   linkId: 'link-123'
 * })
 * 
 * if (validation.isValid) {
 *   console.log('Ready to deposit')
 * } else {
 *   console.error('Validation errors:', validation.errors)
 * }
 */

interface ValidationResult {
  /** Whether request is valid (no blocking errors) */
  isValid: boolean
  
  /** List of blocking errors (if any) */
  errors: string[]
  
  /** List of warnings (non-blocking) */
  warnings: string[]
}

/**
 * Validate deposit amount in lamports
 * 
 * @function validateDepositAmount
 * @param {number} lamports - Amount in lamports to validate
 * @returns {Object} Validation result with error details
 * 
 * @example
 * const validation = validateDepositAmount(100_000_000)
 * 
 * if (validation.isValid) {
 *   console.log(`Amount is valid: ${validation.amountSOL} SOL`)
 * } else {
 *   console.error(`Invalid amount: ${validation.error}`)
 * }
 */

interface AmountValidationResult {
  /** Whether amount is valid */
  isValid: boolean
  
  /** Error message if invalid */
  error?: string
  
  /** Formatted amount in SOL */
  amountSOL?: number
}

// Minimum deposit: 1,000,000 lamports (0.001 SOL)
// Recommended maximum: 10,000,000,000 lamports (10 SOL)

/**
 * Validate Solana address format
 * 
 * @function validateSolanaAddress
 * @param {string} address - Solana address to validate
 * @returns {boolean} True if valid, false otherwise
 * 
 * @example
 * if (validateSolanaAddress('9B5X4jWvXSgEBrBDw8AaQyAjCorLGJQ1S3skWZdQyQD')) {
 *   console.log('Valid address')
 * } else {
 *   console.log('Invalid address')
 * }
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format lamports to SOL with proper decimal places
 * 
 * @function formatLamportsToSOL
 * @param {number} lamports - Amount in lamports
 * @param {number} decimals - Decimal places (default: 6)
 * @returns {string} Formatted SOL amount
 * 
 * @example
 * const solAmount = formatLamportsToSOL(150_000_000)
 * console.log(solAmount) // '0.150000'
 */

/**
 * Convert SOL to lamports
 * 
 * @function parseSOLToLamports
 * @param {number} sol - Amount in SOL
 * @returns {number} Amount in lamports
 * 
 * @example
 * const lamports = parseSOLToLamports(0.1)
 * console.log(lamports) // 100000000
 */

/**
 * Initialize Privacy Cash SDK client
 * 
 * @function initializePrivacyCashClient
 * @param {string} rpcUrl - Solana RPC endpoint URL
 * @param {any} wallet - Wallet adapter or keypair
 * @param {boolean} enableDebug - Enable debug logging (default: false)
 * @returns {PrivacyCash} Initialized PrivacyCash instance
 * 
 * @example
 * const pc = initializePrivacyCashClient(
 *   'https://mainnet.helius-rpc.com',
 *   walletAdapter,
 *   true // enable debug
 * )
 */

/**
 * Map Privacy Cash errors to user-friendly messages
 * 
 * @function mapPrivacyCashError
 * @param {any} error - Error object or message
 * @returns {string} User-friendly error message
 * 
 * @example
 * try {
 *   await executeRealDeposit(request)
 * } catch (error) {
 *   const message = mapPrivacyCashError(error)
 *   alert(message)
 * }
 */

/**
 * Assess deposit privacy characteristics
 * 
 * @function assessDepositPrivacy
 * @param {number} lamports - Deposit amount in lamports
 * @returns {Object} Privacy assessment with recommendations
 * 
 * @example
 * const assessment = assessDepositPrivacy(100_000_000)
 * 
 * if (!assessment.isPrivacySafe) {
 *   console.log('Privacy recommendations:')
 *   assessment.recommendations.forEach(rec => console.log(rec))
 * }
 */

interface PrivacyAssessment {
  /** Whether deposit amount is privacy-optimal */
  isPrivacySafe: boolean
  
  /** List of recommendations to improve privacy */
  recommendations: string[]
}

// Good practice: Use round amounts like:
// - 0.1 SOL (100,000,000 lamports)
// - 1 SOL (1,000,000,000 lamports)
// - 0.5 SOL (500,000,000 lamports)
// Avoid: Unique amounts like 0.123456789 SOL

/**
 * Generate Solana Explorer URL for transaction
 * 
 * @function getExplorerUrl
 * @param {string} txHash - Transaction signature
 * @param {string} cluster - Solana cluster ('mainnet-beta', 'devnet', 'testnet')
 * @returns {string} Explorer URL
 * 
 * @example
 * const url = getExplorerUrl('5kVk...', 'mainnet-beta')
 * window.open(url)
 */

/**
 * Estimate transaction fees
 * 
 * @function estimateTransactionFees
 * @returns {Object} Fee estimates
 * 
 * @example
 * const fees = estimateTransactionFees()
 * 
 * console.log('Network Fee:', fees.networkFee, 'SOL')        // 0.002 SOL
 * console.log('Protocol Fee:', fees.protocolFee, 'SOL')      // 0 SOL
 * console.log('Withdrawal Fee:', fees.withdrawalFee, 'SOL')  // 0.006 SOL (+ 0.35%)
 */

interface FeeEstimate {
  /** Network transaction fee in SOL */
  networkFee: number
  
  /** Protocol fee in SOL (usually 0) */
  protocolFee: number
  
  /** Withdrawal fee in SOL (charged when claiming) */
  withdrawalFee: number
  
  /** Total approximate fee in SOL */
  totalApproximate: number
}

/**
 * Build complete deposit details for display/logging
 * 
 * @function buildDepositDetails
 * @param {number} lamports - Deposit amount in lamports
 * @param {string} address - Sender Solana address
 * @returns {Object} Complete deposit details
 * 
 * @example
 * const details = buildDepositDetails(
 *   100_000_000,
 *   '9B5X4jWvXSgEBrBDw8AaQyAjCorLGJQ1S3skWZdQyQD'
 * )
 * 
 * console.log('Amount:', details.amountSOL, 'SOL')
 * console.log('Fees:', details.estimatedFees)
 * console.log('Privacy:', details.privacyAssessment)
 */

/**
 * Create error context for debugging
 * 
 * @function createDepositErrorContext
 * @param {any} error - Error object
 * @param {Object} context - Additional context
 * @returns {Object} Error context with details
 * 
 * @example
 * try {
 *   await executeRealDeposit(request)
 * } catch (error) {
 *   const context = createDepositErrorContext(error, {
 *     lamports: request.lamports,
 *     wallet: walletAddress,
 *     linkId: request.linkId
 *   })
 *   console.log('Error context:', context)
 * }
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Common error types and solutions
 */

// Error: "Insufficient balance"
// Cause: Wallet doesn't have enough SOL
// Solution: Add more SOL to wallet

// Error: "Don't deposit more than X SOL"
// Cause: Exceeds protocol deposit limit
// Solution: Reduce deposit amount or split into multiple deposits

// Error: "User rejected signature" / "User rejected"
// Cause: User cancelled signature request in Phantom
// Solution: Retry and approve the signature popup

// Error: "response not ok" / "Network error"
// Cause: RPC connection issue
// Solution: Check internet connection, verify RPC URL, try different RPC provider

// Error: "Invalid publicKey format"
// Cause: Malformed Solana address
// Solution: Verify wallet address format

// Error: "Link not found"
// Cause: Link ID doesn't exist in database
// Solution: Verify link ID is correct

// Error: "Deposit already recorded"
// Cause: Link already has a deposit transaction recorded
// Solution: Use a different link ID

// ============================================================================
// BACKEND API ENDPOINTS
// ============================================================================

/**
 * POST /api/deposit
 * 
 * Record deposit transaction in backend database
 * 
 * @request
 * {
 *   "linkId": "string",           // Payment link ID
 *   "depositTx": "string",        // Transaction signature
 *   "amount": "string|number",    // Amount in SOL
 *   "publicKey": "string"         // Sender public key
 * }
 * 
 * @response
 * {
 *   "success": true,
 *   "tx": "string",               // Transaction signature
 *   "amount": "number",           // Amount in SOL
 *   "message": "string",          // Success message
 *   "fee": {
 *     "depositFee": 0,
 *     "note": "Withdrawal fees..."
 *   }
 * }
 * 
 * @errors
 * - 400: Missing or invalid parameters
 * - 404: Link not found
 * - 400: Deposit already recorded for this link
 * - 500: Server error
 * 
 * @example
 * const response = await fetch('/api/deposit', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     linkId: 'link-123',
 *     depositTx: '5kVk...',
 *     amount: '0.1',
 *     publicKey: '9B5X...'
 *   })
 * })
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration object (src/config.ts)
 */

interface ShadowPayConfig {
  // APIs
  BACKEND_URL: string                    // Backend API base URL
  SOLANA_RPC_URL: string                 // Solana RPC endpoint

  // UI
  SHARE_BASE_URL: string                 // Base URL for sharing links

  // Deposit defaults
  DEFAULT_ASSET_TYPE: 'SOL'              // Default asset (only SOL for now)
  SUPPORTED_ASSETS: ['SOL']              // Supported assets

  // Privacy Cash
  PRIVACY_CASH_POOL: string              // Official Privacy Cash pool address
  PRIVACY_CASH_MESSAGE: string           // Sign message for encryption key

  // Timeouts (milliseconds)
  DEPOSIT_TIMEOUT_MS: number             // Deposit timeout
  WITHDRAW_TIMEOUT_MS: number            // Withdraw timeout
  BALANCE_CHECK_TIMEOUT_MS: number       // Balance check timeout
}

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

/**
 * All TypeScript interfaces exported from utilities
 */

export type {
  DepositRequest,
  DepositResult,
  ValidationResult,
  AmountValidationResult,
  PrivacyAssessment,
  FeeEstimate,
  ShadowPayConfig,
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * See exampleIntegrations.ts for complete working examples:
 * - exampleBasicDeposit()
 * - exampleMultipleDeposits()
 * - examplePrivacyOptimizedDeposit()
 * - exampleDepositWithValidation()
 * - exampleDepositWithFeeEstimation()
 * - exampleErrorHandling()
 * - exampleBatchDeposits()
 * - exampleTransactionExplorerUrls()
 */
