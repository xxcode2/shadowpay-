/**
 * SPL Token Withdrawal Processing
 * Complete workflow for SPL token withdrawals with Privacy Cash SDK
 */

import { PublicKey } from '@solana/web3.js'
import {
  validateSPLWithdrawalParams,
  validateSPLWithdrawalAmount,
  formatSPLWithdrawalDetails,
  createSPLWithdrawalContext,
  logSPLWithdrawalEvent,
  formatSPLFeeEstimate,
  getSupportedTokens,
} from './splTokenOperations.js'
import {
  withdrawSPLToken,
  querySPLBalance,
  formatSPLWithdrawalError,
  getPrivacyCashClient,
} from '../services/privacyCash.js'

/**
 * Process SPL token withdrawal workflow
 */
export async function processSPLTokenWithdrawal(
  mintAddress: string | PublicKey,
  amount?: number,
  base_units?: number,
  recipientAddress?: string
): Promise<{
  success: boolean
  tx: string
  recipient: string
  baseUnitsReceived: number
  baseFeeCharged: number
  isPartial: boolean
  message: string
}> {
  const mint = typeof mintAddress === 'string' ? mintAddress : mintAddress.toString()

  // Validate parameters
  const validation = validateSPLWithdrawalParams(mint, amount, base_units, recipientAddress)

  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  if (!validation.token) {
    throw new Error('Token metadata not found')
  }

  const token = validation.token

  try {
    console.log(`\n🚀 Processing SPL Token Withdrawal`)
    console.log(`   Token: ${token.symbol} (${token.name})`)
    console.log(`   Mint: ${mint.substring(0, 8)}...`)

    const pc = getPrivacyCashClient()

    // Get current balance
    const balance = await querySPLBalance(pc, mint)
    console.log(`   Current Balance: ${balance.formatted}`)

    // Determine amount to withdraw in base units
    let withdrawBaseUnits: number

    if (base_units) {
      withdrawBaseUnits = base_units
    } else if (amount) {
      // Convert human-readable amount to base units
      const factor = Math.pow(10, token.decimals)
      withdrawBaseUnits = Math.floor(amount * factor)
    } else {
      throw new Error('No amount specified')
    }

    // Validate sufficient balance
    const amountValidation = await validateSPLWithdrawalAmount(withdrawBaseUnits, token.symbol, balance.baseUnits)

    if (!amountValidation.isValid) {
      throw new Error(amountValidation.error)
    }

    // Get fee estimate
    const feeEstimate = formatSPLFeeEstimate(withdrawBaseUnits, token.symbol)
    console.log(`   Amount: ${feeEstimate.amount}`)
    console.log(`   Est. Fee: ${feeEstimate.estimatedTotalFee}`)
    console.log(`   Est. Received: ${feeEstimate.estimatedNetAmount}`)

    // Log event
    logSPLWithdrawalEvent('initiated', {
      linkId: 'unknown', // Would come from route context
      baseUnits: withdrawBaseUnits,
      symbol: token.symbol,
      recipient: recipientAddress || 'self',
    })

    // Execute withdrawal
    console.log(`\n💸 Executing withdrawal...`)

    const result = await withdrawSPLToken(pc, mint, undefined, withdrawBaseUnits, recipientAddress)

    console.log(`\n✅ Withdrawal Successful!`)
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Received: ${result.base_units} base units`)
    console.log(`   Fee: ${result.fee_base_units} base units`)

    if (result.isPartial) {
      console.log(`   ⚠️ PARTIAL WITHDRAWAL - balance was insufficient`)
    }

    logSPLWithdrawalEvent('success', {
      linkId: 'unknown',
      baseUnits: withdrawBaseUnits,
      symbol: token.symbol,
      recipient: result.recipient,
      tx: result.tx,
    })

    return {
      success: true,
      tx: result.tx,
      recipient: result.recipient,
      baseUnitsReceived: result.base_units,
      baseFeeCharged: result.fee_base_units,
      isPartial: result.isPartial,
      message: result.isPartial
        ? `Partial withdrawal: ${result.base_units} base units withdrawn`
        : `Withdrawal successful: ${result.base_units} base units withdrawn`,
    }
  } catch (err: any) {
    console.error('❌ Withdrawal Error:', err.message)

    logSPLWithdrawalEvent('failed', {
      linkId: 'unknown',
      baseUnits: base_units || 0,
      symbol: token.symbol,
      recipient: recipientAddress || 'unknown',
      error: err.message,
    })

    const formattedError = formatSPLWithdrawalError(err)
    throw new Error(formattedError)
  }
}

/**
 * Get SPL token withdrawal fee estimate
 */
export async function estimateSPLTokenWithdrawalFee(
  mintAddress: string | PublicKey,
  amount?: number,
  base_units?: number
): Promise<{
  token: string
  amount: string
  percentageFee: string
  estimatedTotalFee: string
  estimatedNetAmount: string
}> {
  const mint = typeof mintAddress === 'string' ? mintAddress : mintAddress.toString()

  const validation = validateSPLWithdrawalParams(mint, amount, base_units)

  if (!validation.isValid || !validation.token) {
    throw new Error(validation.error)
  }

  const token = validation.token

  let baseUnits: number

  if (base_units) {
    baseUnits = base_units
  } else if (amount) {
    const factor = Math.pow(10, token.decimals)
    baseUnits = Math.floor(amount * factor)
  } else {
    throw new Error('No amount specified')
  }

  return {
    token: token.symbol,
    ...formatSPLFeeEstimate(baseUnits, token.symbol),
  }
}

/**
 * Check if address has sufficient SPL token balance
 */
export async function checkSPLBalance(mintAddress: string | PublicKey): Promise<{
  hasSufficientBalance: (baseUnits: number) => boolean
  balance: number
  formatted: string
}> {
  const mint = typeof mintAddress === 'string' ? mintAddress : mintAddress.toString()

  const pc = getPrivacyCashClient()

  try {
    const balance = await querySPLBalance(pc, mint)

    return {
      hasSufficientBalance: (baseUnits: number) => baseUnits <= balance.baseUnits,
      balance: balance.baseUnits,
      formatted: balance.formatted,
    }
  } catch (err: any) {
    throw new Error(`Failed to check balance: ${err.message}`)
  }
}

/**
 * Get all supported SPL tokens info
 */
export function getSupportedSPLTokensList() {
  return getSupportedTokens()
}

/**
 * Create SPL withdrawal error response
 */
export function createSPLWithdrawalErrorResponse(
  error: any,
  context: {
    mintAddress?: string
    amount?: number
    baseUnits?: number
    recipientAddress?: string
  }
): {
  success: false
  error: string
  userMessage: string
  context: any
  timestamp: string
  suggestedAction: string
} {
  const errorMsg = error.message || 'Unknown error'
  const formattedError = formatSPLWithdrawalError(error)

  let suggestedAction = 'Please try again'

  if (errorMsg.includes('Insufficient')) {
    suggestedAction = 'Check the available balance and try a smaller amount'
  } else if (errorMsg.includes('Invalid')) {
    suggestedAction = 'Verify the token mint address and recipient wallet'
  } else if (errorMsg.includes('Network') || errorMsg.includes('RPC')) {
    suggestedAction = 'Check your internet connection and try again'
  } else if (errorMsg.includes('not supported')) {
    suggestedAction = `View supported tokens at /api/tokens/supported`
  }

  return {
    success: false,
    error: errorMsg,
    userMessage: formattedError,
    context,
    timestamp: new Date().toISOString(),
    suggestedAction,
  }
}

/**
 * Validate SPL token is in allowed list
 */
export function validateSPLTokenAllowed(mintAddress: string | PublicKey): {
  isAllowed: boolean
  token?: string
  error?: string
} {
  const mint = typeof mintAddress === 'string' ? mintAddress : mintAddress.toString()

  const allowedTokens = getSupportedSPLTokensList()
  const token = allowedTokens.find(t => t.mint === mint)

  if (!token) {
    return {
      isAllowed: false,
      error: `Token ${mint} is not in the allowed list. Supported tokens: ${allowedTokens.map(t => t.symbol).join(', ')}`,
    }
  }

  return {
    isAllowed: true,
    token: token.symbol,
  }
}
