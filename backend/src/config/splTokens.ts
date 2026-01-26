/**
 * SPL Token Configuration
 * Supported tokens and their metadata for Privacy Cash operations
 */

import { PublicKey } from '@solana/web3.js'

/**
 * Supported SPL token list
 */
export const SUPPORTED_SPL_TOKENS = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    depositFee: 'Free',
    withdrawalFee: 'Rent fee + 0.35%',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    depositFee: 'Free',
    withdrawalFee: 'Rent fee + 0.35%',
  },
  ZEC: {
    symbol: 'ZEC',
    name: 'Zcash',
    mint: 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
    decimals: 8,
    depositFee: 'Free',
    withdrawalFee: 'Rent fee + 0.35%',
  },
  ORE: {
    symbol: 'ORE',
    name: 'ORE',
    mint: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
    decimals: 11,
    depositFee: 'Free',
    withdrawalFee: 'Rent fee + 0.35%',
  },
  STORE: {
    symbol: 'STORE',
    name: 'STORE',
    mint: 'sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH',
    decimals: 11,
    depositFee: 'Free',
    withdrawalFee: 'Rent fee + 0.35%',
  },
} as const

/**
 * Token type
 */
export type SupportedToken = keyof typeof SUPPORTED_SPL_TOKENS

/**
 * Get token by symbol
 */
export function getToken(symbol: string) {
  const token = SUPPORTED_SPL_TOKENS[symbol as SupportedToken]
  if (!token) {
    throw new Error(`Token ${symbol} not supported`)
  }
  return token
}

/**
 * Get token by mint address
 */
export function getTokenByMint(mint: string) {
  const token = Object.values(SUPPORTED_SPL_TOKENS).find(t => t.mint === mint)
  if (!token) {
    throw new Error(`No token found with mint ${mint}`)
  }
  return token
}

/**
 * Validate if token is supported
 */
export function isSupportedToken(symbol: string): symbol is SupportedToken {
  return symbol in SUPPORTED_SPL_TOKENS
}

/**
 * Validate if mint is supported
 */
export function isSupportedMint(mint: string): boolean {
  return Object.values(SUPPORTED_SPL_TOKENS).some(t => t.mint === mint)
}

/**
 * Get all supported tokens
 */
export function getAllSupportedTokens() {
  return Object.entries(SUPPORTED_SPL_TOKENS).map(([sym, token]) => ({
    symbol: sym,
    ...token,
  }))
}

/**
 * Convert human-readable amount to base units
 */
export function toBaseUnits(amount: number, decimals: number): number {
  return Math.floor(amount * Math.pow(10, decimals))
}

/**
 * Convert base units to human-readable amount
 */
export function fromBaseUnits(baseUnits: number, decimals: number): number {
  return baseUnits / Math.pow(10, decimals)
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(baseUnits: number, symbol: string): string {
  const token = getToken(symbol)
  const amount = fromBaseUnits(baseUnits, token.decimals)
  return `${amount.toFixed(token.decimals)} ${symbol}`
}

/**
 * Validate token amount
 */
export function validateTokenAmount(
  amount: number,
  symbol: string
): { isValid: boolean; error?: string } {
  if (amount <= 0) {
    return {
      isValid: false,
      error: `Amount must be greater than 0`,
    }
  }

  const token = getToken(symbol)
  const baseUnits = toBaseUnits(amount, token.decimals)

  if (baseUnits > Number.MAX_SAFE_INTEGER) {
    return {
      isValid: false,
      error: `Amount is too large`,
    }
  }

  return { isValid: true }
}

/**
 * Estimate SPL withdrawal fee
 * Privacy Cash charges ~0.35% for SPL withdrawals + rent fee
 */
export function estimateSPLWithdrawalFee(
  baseUnits: number,
  symbol: string
): {
  percentageFee: number
  estimatedTotalFee: number
  netAmount: number
  feePercentage: string
} {
  const percentageFee = Math.floor(baseUnits * 0.0035) // 0.35%
  const estimatedRentFee = 2039 // Approximate rent fee in lamports for token accounts

  // Convert rent fee to token base units (this is approximate)
  const estimatedTotalFee = percentageFee + estimatedRentFee

  return {
    percentageFee,
    estimatedTotalFee,
    netAmount: baseUnits - estimatedTotalFee,
    feePercentage: '0.35%',
  }
}

/**
 * SPL Token fee structure
 */
export const SPL_TOKEN_FEES = {
  deposit: {
    percentage: 0,
    label: 'Free',
  },
  withdrawal: {
    percentage: 0.0035, // 0.35%
    label: '0.35% + Rent fee',
    estimatedRentFee: 2039, // In lamports
  },
} as const
