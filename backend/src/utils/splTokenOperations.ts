/**
 * SPL Token Operations Utilities
 * Helper functions for SPL token deposit, withdraw, and balance operations
 */

import { PublicKey } from '@solana/web3.js'
import {
  SUPPORTED_SPL_TOKENS,
  isSupportedToken,
  isSupportedMint,
  getToken,
  getTokenByMint,
  toBaseUnits,
  fromBaseUnits,
  formatTokenAmount,
  validateTokenAmount,
  estimateSPLWithdrawalFee,
} from '../config/splTokens.js'

/**
 * Validate SPL token deposit parameters
 */
export function validateSPLDepositParams(
  mintAddress: string | PublicKey,
  amount?: number,
  base_units?: number
): { isValid: boolean; error?: string; token?: typeof SUPPORTED_SPL_TOKENS[keyof typeof SUPPORTED_SPL_TOKENS] } {
  const mint = typeof mintAddress === 'string' ? mintAddress : mintAddress.toString()

  if (!isSupportedMint(mint)) {
    return {
      isValid: false,
      error: `Token mint ${mint} is not supported`,
    }
  }

  if (!amount && !base_units) {
    return {
      isValid: false,
      error: 'Either amount or base_units must be provided',
    }
  }

  if (amount && base_units) {
    return {
      isValid: false,
      error: 'Provide either amount OR base_units, not both',
    }
  }

  const token = getTokenByMint(mint)

  if (amount) {
    const validation = validateTokenAmount(amount, token.symbol)
    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.error,
        token,
      }
    }
  }

  if (base_units && base_units <= 0) {
    return {
      isValid: false,
      error: 'base_units must be greater than 0',
      token,
    }
  }

  return { isValid: true, token }
}

/**
 * Validate SPL token withdrawal parameters
 */
export function validateSPLWithdrawalParams(
  mintAddress: string | PublicKey,
  amount?: number,
  base_units?: number,
  recipientAddress?: string
): { isValid: boolean; error?: string; token?: typeof SUPPORTED_SPL_TOKENS[keyof typeof SUPPORTED_SPL_TOKENS] } {
  const mint = typeof mintAddress === 'string' ? mintAddress : mintAddress.toString()

  if (!isSupportedMint(mint)) {
    return {
      isValid: false,
      error: `Token mint ${mint} is not supported`,
    }
  }

  if (!amount && !base_units) {
    return {
      isValid: false,
      error: 'Either amount or base_units must be provided',
    }
  }

  if (amount && base_units) {
    return {
      isValid: false,
      error: 'Provide either amount OR base_units, not both',
    }
  }

  if (recipientAddress) {
    try {
      new PublicKey(recipientAddress)
    } catch {
      return {
        isValid: false,
        error: 'Invalid recipient address format',
      }
    }
  }

  const token = getTokenByMint(mint)

  if (amount) {
    const validation = validateTokenAmount(amount, token.symbol)
    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.error,
        token,
      }
    }
  }

  return { isValid: true, token }
}

/**
 * Format SPL deposit details for logging
 */
export function formatSPLDepositDetails(
  baseUnits: number,
  symbol: string
): {
  baseUnits: number
  amount: number
  symbol: string
  displayAmount: string
  decimals: number
} {
  const token = getToken(symbol)
  const amount = fromBaseUnits(baseUnits, token.decimals)

  return {
    baseUnits,
    amount,
    symbol,
    displayAmount: formatTokenAmount(baseUnits, symbol),
    decimals: token.decimals,
  }
}

/**
 * Format SPL withdrawal details for logging
 */
export function formatSPLWithdrawalDetails(
  baseUnits: number,
  symbol: string,
  recipientAddress: string
): {
  baseUnits: number
  amount: number
  symbol: string
  displayAmount: string
  recipientAddress: string
  recipientShort: string
  decimals: number
} {
  const token = getToken(symbol)
  const amount = fromBaseUnits(baseUnits, token.decimals)
  const recipientShort = `${recipientAddress.substring(0, 8)}...${recipientAddress.substring(-6)}`

  return {
    baseUnits,
    amount,
    symbol,
    displayAmount: formatTokenAmount(baseUnits, symbol),
    recipientAddress,
    recipientShort,
    decimals: token.decimals,
  }
}

/**
 * Create SPL deposit context
 */
export function createSPLDepositContext(
  linkId: string,
  baseUnits: number,
  symbol: string
): {
  linkId: string
  baseUnits: number
  symbol: string
  timestamp: string
  details: ReturnType<typeof formatSPLDepositDetails>
} {
  return {
    linkId,
    baseUnits,
    symbol,
    timestamp: new Date().toISOString(),
    details: formatSPLDepositDetails(baseUnits, symbol),
  }
}

/**
 * Create SPL withdrawal context
 */
export function createSPLWithdrawalContext(
  linkId: string,
  baseUnits: number,
  symbol: string,
  recipientAddress: string
): {
  linkId: string
  baseUnits: number
  symbol: string
  recipientAddress: string
  timestamp: string
  details: ReturnType<typeof formatSPLWithdrawalDetails>
} {
  return {
    linkId,
    baseUnits,
    symbol,
    recipientAddress,
    timestamp: new Date().toISOString(),
    details: formatSPLWithdrawalDetails(baseUnits, symbol, recipientAddress),
  }
}

/**
 * Log SPL deposit event
 */
export function logSPLDepositEvent(
  event: 'initiated' | 'processing' | 'success' | 'failed',
  details: {
    linkId: string
    baseUnits: number
    symbol: string
    tx?: string
    error?: string
  }
): void {
  const token = getToken(details.symbol)
  const timestamp = new Date().toISOString()

  const eventLog = {
    timestamp,
    event,
    linkId: details.linkId,
    amount: formatTokenAmount(details.baseUnits, details.symbol),
    symbol: details.symbol,
    tx: details.tx || 'pending',
    error: details.error || undefined,
  }

  console.log(`[SPL-DEPOSIT-${event.toUpperCase()}]`, JSON.stringify(eventLog))
}

/**
 * Log SPL withdrawal event
 */
export function logSPLWithdrawalEvent(
  event: 'initiated' | 'processing' | 'success' | 'failed',
  details: {
    linkId: string
    baseUnits: number
    symbol: string
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
    amount: formatTokenAmount(details.baseUnits, details.symbol),
    symbol: details.symbol,
    recipient: details.recipient,
    tx: details.tx || 'pending',
    error: details.error || undefined,
  }

  console.log(`[SPL-WITHDRAWAL-${event.toUpperCase()}]`, JSON.stringify(eventLog))
}

/**
 * Format SPL withdrawal fee estimate
 */
export function formatSPLFeeEstimate(baseUnits: number, symbol: string): {
  amount: string
  percentageFee: string
  estimatedTotalFee: string
  estimatedNetAmount: string
} {
  const estimate = estimateSPLWithdrawalFee(baseUnits, symbol)

  return {
    amount: formatTokenAmount(baseUnits, symbol),
    percentageFee: formatTokenAmount(estimate.percentageFee, symbol),
    estimatedTotalFee: formatTokenAmount(estimate.estimatedTotalFee, symbol),
    estimatedNetAmount: formatTokenAmount(estimate.netAmount, symbol),
  }
}

/**
 * Validate SPL withdrawal amount against available balance
 */
export async function validateSPLWithdrawalAmount(
  baseUnits: number,
  symbol: string,
  availableBalance: number
): Promise<{
  isValid: boolean
  error?: string
  availableBalance?: number
  requestedAmount?: number
}> {
  if (baseUnits > availableBalance) {
    const token = getToken(symbol)
    return {
      isValid: false,
      error: `Insufficient balance. Available: ${formatTokenAmount(availableBalance, symbol)}, Requested: ${formatTokenAmount(baseUnits, symbol)}`,
      availableBalance,
      requestedAmount: baseUnits,
    }
  }

  return { isValid: true }
}

/**
 * Get all supported SPL tokens
 */
export function getSupportedTokens() {
  return Object.entries(SUPPORTED_SPL_TOKENS).map(([sym, token]) => ({
    symbol: sym,
    ...token,
  }))
}

/**
 * Check if mint is USDC
 */
export function isUSDCMint(mint: string | PublicKey): boolean {
  const mintStr = typeof mint === 'string' ? mint : mint.toString()
  return mintStr === SUPPORTED_SPL_TOKENS.USDC.mint
}

/**
 * Check if mint is USDT
 */
export function isUSDTMint(mint: string | PublicKey): boolean {
  const mintStr = typeof mint === 'string' ? mint : mint.toString()
  return mintStr === SUPPORTED_SPL_TOKENS.USDT.mint
}

export {
  SUPPORTED_SPL_TOKENS,
  isSupportedToken,
  isSupportedMint,
  getToken,
  getTokenByMint,
  toBaseUnits,
  fromBaseUnits,
  formatTokenAmount,
  validateTokenAmount,
  estimateSPLWithdrawalFee,
}
