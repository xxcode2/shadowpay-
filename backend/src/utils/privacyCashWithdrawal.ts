/**
 * Backend Privacy Cash SDK Utilities
 * Helper functions for backend operations with Privacy Cash
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  getPrivacyCashClient,
  queryPrivateBalance,
  executeWithdrawal,
  lamportsToSol,
  solToLamports,
  formatWithdrawalError,
} from '../services/privacyCash.js'

/**
 * Validate withdrawal parameters
 */
export function validateWithdrawalParams(
  lamports: number,
  recipientAddress: string
): { isValid: boolean; error?: string } {
  if (!lamports || lamports <= 0) {
    return {
      isValid: false,
      error: 'Invalid withdrawal amount',
    }
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    return {
      isValid: false,
      error: 'Invalid recipient address',
    }
  }

  // Basic check for solana address length (44-45 chars for base58)
  if (recipientAddress.length < 40 || recipientAddress.length > 50) {
    return {
      isValid: false,
      error: 'Recipient address appears to be invalid length',
    }
  }

  return { isValid: true }
}

/**
 * Process withdrawal with Privacy Cash SDK
 * Executes withdrawal from shielded pool to recipient
 */
export async function processPrivacyCashWithdrawal(
  lamports: number,
  recipientAddress: string
): Promise<{
  success: boolean
  tx: string
  lamports: number
  sol: number
  message: string
}> {
  const validation = validateWithdrawalParams(lamports, recipientAddress)

  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  try {
    const pc = getPrivacyCashClient()

    console.log(`🚀 Executing withdrawal from Privacy Cash pool...`)
    console.log(`   Amount: ${lamportsToSol(lamports).toFixed(6)} SOL (${lamports} lamports)`)
    console.log(`   Recipient: ${recipientAddress.substring(0, 8)}...`)

    const result = await executeWithdrawal(pc, lamports, recipientAddress)

    console.log(`✅ Withdrawal successful!`)
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Amount: ${result.sol.toFixed(6)} SOL`)

    return {
      success: true,
      tx: result.tx,
      lamports: result.lamports,
      sol: result.sol,
      message: `Withdrawal successful: ${result.sol.toFixed(6)} SOL withdrawn`,
    }
  } catch (err: any) {
    console.error('❌ Withdrawal error:', err)

    const errorMsg = formatWithdrawalError(err)
    throw new Error(errorMsg)
  }
}

/**
 * Check private balance in Privacy Cash pool
 * Used to validate sufficient funds before processing withdrawal
 */
export async function checkPrivateBalance(): Promise<{
  lamports: number
  sol: number
  hasSufficientBalance: (amount: number) => boolean
  message: string
}> {
  try {
    const pc = getPrivacyCashClient()

    console.log('🔍 Checking private balance in Privacy Cash pool...')

    const balance = await queryPrivateBalance(pc)

    console.log(`✅ Balance check complete`)
    console.log(`   Amount: ${balance.formatted}`)

    return {
      lamports: balance.lamports,
      sol: balance.sol,
      hasSufficientBalance: (amount: number) => amount <= balance.lamports,
      message: `Current balance: ${balance.formatted}`,
    }
  } catch (err: any) {
    console.error('❌ Balance check error:', err)
    throw new Error(`Failed to check balance: ${err.message}`)
  }
}

/**
 * Validate withdrawal amount against available balance
 */
export async function validateWithdrawalAmount(
  lamports: number
): Promise<{
  isValid: boolean
  error?: string
  availableBalance?: number
  requestedAmount?: number
}> {
  try {
    const balance = await checkPrivateBalance()

    if (lamports > balance.lamports) {
      return {
        isValid: false,
        error: `Insufficient balance. Available: ${lamportsToSol(balance.lamports).toFixed(6)} SOL, Requested: ${lamportsToSol(lamports).toFixed(6)} SOL`,
        availableBalance: balance.lamports,
        requestedAmount: lamports,
      }
    }

    return {
      isValid: true,
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: `Failed to validate withdrawal amount: ${err.message}`,
    }
  }
}

/**
 * Format withdrawal details for logging/display
 */
export function formatWithdrawalDetails(
  lamports: number,
  recipientAddress: string
): {
  lamports: number
  sol: string
  recipient: string
  recipientShort: string
  displayAmount: string
} {
  const sol = lamportsToSol(lamports)
  const recipientShort = `${recipientAddress.substring(0, 8)}...${recipientAddress.substring(-6)}`

  return {
    lamports,
    sol: sol.toFixed(6),
    recipient: recipientAddress,
    recipientShort,
    displayAmount: `${sol.toFixed(6)} SOL`,
  }
}

/**
 * Create withdrawal transaction context
 */
export function createWithdrawalContext(
  linkId: string,
  lamports: number,
  recipientAddress: string
): {
  linkId: string
  lamports: number
  sol: number
  recipientAddress: string
  timestamp: string
  details: ReturnType<typeof formatWithdrawalDetails>
} {
  return {
    linkId,
    lamports,
    sol: lamportsToSol(lamports),
    recipientAddress,
    timestamp: new Date().toISOString(),
    details: formatWithdrawalDetails(lamports, recipientAddress),
  }
}

/**
 * Handle withdrawal error with context
 */
export function createWithdrawalErrorContext(
  error: any,
  context: {
    linkId?: string
    lamports?: number
    recipientAddress?: string
  }
): {
  error: string
  userMessage: string
  context: any
  timestamp: string
  suggestedAction: string
} {
  const errorMsg = formatWithdrawalError(error)

  let suggestedAction = 'Please try again'

  if (errorMsg.includes('Insufficient')) {
    suggestedAction = 'Check the available balance and try a smaller amount'
  } else if (errorMsg.includes('Invalid recipient')) {
    suggestedAction = 'Verify the recipient wallet address'
  } else if (errorMsg.includes('Network')) {
    suggestedAction = 'Check your internet connection and try again'
  }

  return {
    error: error?.message || 'Unknown error',
    userMessage: errorMsg,
    context,
    timestamp: new Date().toISOString(),
    suggestedAction,
  }
}

/**
 * Log withdrawal event
 */
export function logWithdrawalEvent(
  event: 'initiated' | 'processing' | 'success' | 'failed',
  details: {
    linkId: string
    amount: number
    recipient: string
    tx?: string
    error?: string
  }
): void {
  const timestamp = new Date().toISOString()

  const eventLog = {
    timestamp,
    event,
    linkId: details.linkId,
    amount: `${lamportsToSol(details.amount).toFixed(6)} SOL`,
    recipient: details.recipient,
    tx: details.tx || 'pending',
    error: details.error || undefined,
  }

  console.log(`[WITHDRAWAL-${event.toUpperCase()}]`, JSON.stringify(eventLog))
}

/**
 * Get estimated withdrawal fee
 * Privacy Cash charges ~0.006 SOL + 0.35% for withdrawals
 */
export function estimateWithdrawalFee(lamports: number): {
  baseFee: number
  percentageFee: number
  totalFee: number
  netAmount: number
  totalDeducted: number
  percentageLabel: string
} {
  const baseFeeSOL = 0.006
  const baseFeelamports = solToLamports(baseFeeSOL)
  const percentageFee = Math.floor(lamports * 0.0035) // 0.35%
  const totalFee = baseFeelamports + percentageFee
  const netAmount = lamports - totalFee

  return {
    baseFee: baseFeelamports,
    percentageFee,
    totalFee,
    netAmount,
    totalDeducted: totalFee,
    percentageLabel: '0.35%',
  }
}

/**
 * Format withdrawal fee estimate for display
 */
export function formatFeeEstimate(lamports: number): {
  grossAmount: string
  baseFee: string
  percentageFee: string
  totalFees: string
  netAmount: string
} {
  const estimate = estimateWithdrawalFee(lamports)

  return {
    grossAmount: `${lamportsToSol(lamports).toFixed(6)} SOL`,
    baseFee: `${lamportsToSol(estimate.baseFee).toFixed(6)} SOL`,
    percentageFee: `${lamportsToSol(estimate.percentageFee).toFixed(6)} SOL`,
    totalFees: `${lamportsToSol(estimate.totalFee).toFixed(6)} SOL`,
    netAmount: `${lamportsToSol(estimate.netAmount).toFixed(6)} SOL`,
  }
}

export {
  getPrivacyCashClient,
  queryPrivateBalance,
  executeWithdrawal,
  lamportsToSol,
  solToLamports,
  formatWithdrawalError,
}
