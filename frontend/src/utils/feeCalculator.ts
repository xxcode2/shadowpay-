/**
 * Fee calculation and handling utilities
 */

export const FEE_CONFIG = {
  OWNER_WALLET: 'Endz5whgDQ8L92Ji8vPfrA3yAVYpS2gx5U7KSS4KLgv6',
  FEE_PERCENTAGE: 0.01, // 1%
}

/**
 * Calculate fee amount from total amount
 * @param amountLamports Amount in lamports
 * @returns Fee in lamports (rounded down)
 */
export function calculateFee(amountLamports: number): number {
  return Math.floor(amountLamports * FEE_CONFIG.FEE_PERCENTAGE)
}

/**
 * Calculate net amount after fee deduction
 * @param amountLamports Amount in lamports
 * @returns Net amount in lamports (amount - fee)
 */
export function getNetAmount(amountLamports: number): number {
  const fee = calculateFee(amountLamports)
  return amountLamports - fee
}

/**
 * Format fee breakdown for display
 * @param amountLamports Total amount in lamports
 * @returns Object with gross, fee, and net amounts in SOL
 */
export function formatFeeBreakdown(amountLamports: number): {
  gross: string
  fee: string
  net: string
  feePercentage: string
} {
  const fee = calculateFee(amountLamports)
  const net = amountLamports - fee
  
  return {
    gross: (amountLamports / 1e9).toFixed(6),
    fee: (fee / 1e9).toFixed(6),
    net: (net / 1e9).toFixed(6),
    feePercentage: (FEE_CONFIG.FEE_PERCENTAGE * 100).toFixed(0),
  }
}

/**
 * Get fee breakdown message for UI
 * @param amountLamports Amount in lamports
 * @returns Human-readable fee message
 */
export function getFeeMessage(amountLamports: number): string {
  const breakdown = formatFeeBreakdown(amountLamports)
  return `💰 Gross: ${breakdown.gross} SOL | Fee: ${breakdown.fee} SOL (${breakdown.feePercentage}%) | Net: ${breakdown.net} SOL`
}
