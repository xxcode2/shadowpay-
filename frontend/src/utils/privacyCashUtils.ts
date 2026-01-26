/**
 * Privacy Cash SDK Utility Functions
 * Provides helper functions for Privacy Cash SDK operations
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
// @ts-ignore - privacycash types may not be available
import { PrivacyCash } from 'privacycash'

/**
 * Error codes and messages for Privacy Cash operations
 */
export const PRIVACY_CASH_ERRORS = {
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  DEPOSIT_LIMIT_EXCEEDED: "Don't deposit more than",
  USER_REJECTED: 'User rejected',
  INVALID_AMOUNT: 'Invalid amount',
  RPC_CONNECTION_FAILED: 'response not ok',
  INVALID_ADDRESS: 'Invalid address',
  NETWORK_ERROR: 'Network error',
} as const

/**
 * Deposit limits (in lamports)
 * These are protocol-enforced limits
 */
export const DEPOSIT_LIMITS = {
  MIN: 1_000_000,        // 0.001 SOL
  MAX: 100_000_000_000,  // 100 SOL (typical protocol limit)
  RECOMMENDED_MAX: 10_000_000_000, // 10 SOL (safe limit)
} as const

/**
 * Validate deposit amount
 * @param lamports Amount in lamports to validate
 * @returns Validation result with error message if invalid
 */
export function validateDepositAmount(lamports: number): {
  isValid: boolean
  error?: string
  amountSOL?: number
} {
  // Check for valid number
  if (!Number.isFinite(lamports) || lamports <= 0) {
    return {
      isValid: false,
      error: 'Amount must be a positive number',
    }
  }

  // Check minimum amount
  if (lamports < DEPOSIT_LIMITS.MIN) {
    const minSOL = (DEPOSIT_LIMITS.MIN / LAMPORTS_PER_SOL).toFixed(6)
    return {
      isValid: false,
      error: `Minimum deposit is ${minSOL} SOL`,
    }
  }

  // Check recommended maximum
  if (lamports > DEPOSIT_LIMITS.RECOMMENDED_MAX) {
    const maxSOL = (DEPOSIT_LIMITS.RECOMMENDED_MAX / LAMPORTS_PER_SOL).toFixed(6)
    return {
      isValid: true, // Still valid, but warn user
      error: `Deposit exceeds recommended limit of ${maxSOL} SOL. Consider splitting into smaller deposits.`,
      amountSOL: lamports / LAMPORTS_PER_SOL,
    }
  }

  return {
    isValid: true,
    amountSOL: lamports / LAMPORTS_PER_SOL,
  }
}

/**
 * Validate Solana address format
 * @param address Address to validate
 * @returns true if valid, false otherwise
 */
export function validateSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Format lamports to SOL with proper precision
 * @param lamports Amount in lamports
 * @param decimals Number of decimal places (default: 6)
 * @returns Formatted SOL amount as string
 */
export function formatLamportsToSOL(
  lamports: number,
  decimals: number = 6
): string {
  const sol = lamports / LAMPORTS_PER_SOL
  return sol.toFixed(decimals)
}

/**
 * Parse SOL to lamports
 * @param sol Amount in SOL
 * @returns Amount in lamports
 */
export function parseSOLToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

/**
 * Initialize Privacy Cash SDK client
 * @param rpcUrl Solana RPC endpoint URL
 * @param wallet Wallet adapter with publicKey
 * @param enableDebug Enable debug logging
 * @returns PrivacyCash SDK instance
 */
export function initializePrivacyCashClient(
  rpcUrl: string,
  wallet: any,
  enableDebug: boolean = false
): any {
  if (!rpcUrl) {
    throw new Error('RPC URL is required to initialize Privacy Cash SDK')
  }

  if (!wallet) {
    throw new Error('Wallet is required to initialize Privacy Cash SDK')
  }

  // PrivacyCash SDK on browser expects the public key string
  // The SDK handles the actual signing through the wallet adapter
  const publicKeyString = wallet.publicKey?.toString?.() || wallet.toString?.() || wallet

  return new PrivacyCash({
    RPC_url: rpcUrl,
    owner: publicKeyString,
    enableDebug,
  } as any)
}

/**
 * Map Privacy Cash errors to user-friendly messages
 * @param error Error object or message
 * @returns User-friendly error message
 */
export function mapPrivacyCashError(error: any): string {
  const errorMessage = error?.message?.toLowerCase() || error?.toString?.() || ''

  // Insufficient balance
  if (errorMessage.includes(PRIVACY_CASH_ERRORS.INSUFFICIENT_BALANCE)) {
    return '❌ Your wallet does not have enough SOL. Please add more SOL and try again.'
  }

  // Deposit limit exceeded
  if (errorMessage.includes(PRIVACY_CASH_ERRORS.DEPOSIT_LIMIT_EXCEEDED)) {
    return '❌ Deposit amount exceeds protocol limit. Please reduce the amount and try again.'
  }

  // User rejected signature
  if (errorMessage.includes(PRIVACY_CASH_ERRORS.USER_REJECTED)) {
    return '❌ You rejected the signature request. Please approve the Phantom popup to continue.'
  }

  // RPC connection error
  if (errorMessage.includes(PRIVACY_CASH_ERRORS.RPC_CONNECTION_FAILED)) {
    return '❌ Network error. Please check your internet connection and try again.'
  }

  // Invalid address
  if (errorMessage.includes(PRIVACY_CASH_ERRORS.INVALID_ADDRESS)) {
    return '❌ Invalid Solana address. Please check your wallet address.'
  }

  // Network error
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return '❌ Network error. Please check your connection and try again.'
  }

  // Generic error with helpful hint
  return `❌ Deposit failed: ${error?.message || 'Unknown error'}. Please try again or contact support.`
}

/**
 * Check if deposit amount is "safe" (privacy-optimal)
 * Recommends using round amounts and common values
 * @param lamports Amount in lamports
 * @returns Object with safety assessment
 */
export function assessDepositPrivacy(lamports: number): {
  isPrivacySafe: boolean
  recommendations: string[]
} {
  const recommendations: string[] = []
  let isPrivacySafe = true

  // Check if amount is round (ends in 0s)
  const amountStr = lamports.toString()
  const trailingZeros = amountStr.length - amountStr.replace(/0+$/, '').length

  if (trailingZeros < 6) {
    isPrivacySafe = false
    recommendations.push('💡 Use a rounder amount (e.g., 100,000,000 instead of 123,456,789) for better privacy')
  }

  // Check if amount is a common deposit amount
  const commonAmounts = [
    1_000_000,        // 0.001 SOL
    10_000_000,       // 0.01 SOL
    100_000_000,      // 0.1 SOL
    500_000_000,      // 0.5 SOL
    1_000_000_000,    // 1 SOL
    5_000_000_000,    // 5 SOL
    10_000_000_000,   // 10 SOL
  ]

  if (!commonAmounts.includes(lamports)) {
    recommendations.push('💡 Consider using a common deposit amount to maximize anonymity')
  }

  return {
    isPrivacySafe,
    recommendations,
  }
}

/**
 * Format transaction explorer URL
 * @param txHash Transaction signature
 * @param cluster Solana cluster (mainnet-beta, devnet, testnet)
 * @returns Explorer URL
 */
export function getExplorerUrl(
  txHash: string,
  cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'
): string {
  const baseUrl = cluster === 'mainnet-beta' 
    ? 'https://explorer.solana.com'
    : `https://explorer.solana.com?cluster=${cluster}`
  
  return `${baseUrl}/tx/${txHash}`
}

/**
 * Estimate transaction fees
 * @returns Estimated fee details
 */
export function estimateTransactionFees(): {
  networkFee: number
  protocolFee: number
  withdrawalFee: number
  totalApproximate: number
} {
  return {
    networkFee: 0.002,           // SOL
    protocolFee: 0,              // SOL
    withdrawalFee: 0.006,        // SOL + 0.35% (when claiming)
    totalApproximate: 0.008,     // Approximate SOL for deposit only
  }
}

/**
 * Build deposit transaction details for logging/display
 * @param lamports Amount in lamports
 * @param address Sender address
 * @returns Formatted deposit details
 */
export function buildDepositDetails(lamports: number, address: string): {
  amountSOL: string
  amountLamports: number
  senderAddress: string
  estimatedFees: ReturnType<typeof estimateTransactionFees>
  privacyAssessment: ReturnType<typeof assessDepositPrivacy>
} {
  return {
    amountSOL: formatLamportsToSOL(lamports),
    amountLamports: lamports,
    senderAddress: address,
    estimatedFees: estimateTransactionFees(),
    privacyAssessment: assessDepositPrivacy(lamports),
  }
}

/**
 * Create deposit error context for debugging
 * @param error Original error
 * @param context Additional context
 * @returns Error context object
 */
export function createDepositErrorContext(
  error: any,
  context?: {
    lamports?: number
    wallet?: string
    linkId?: string
    rpcUrl?: string
  }
): {
  error: string
  userMessage: string
  context: any
  timestamp: string
} {
  return {
    error: error?.message || error?.toString?.() || 'Unknown error',
    userMessage: mapPrivacyCashError(error),
    context: {
      ...context,
      errorType: error?.name || 'Unknown',
      errorStack: error?.stack,
    },
    timestamp: new Date().toISOString(),
  }
}
