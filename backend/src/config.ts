import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
  ENABLE_DEBUG: process.env.ENABLE_DEBUG === 'true',
  LINKS_STORAGE_PATH: process.env.LINKS_STORAGE_PATH || './data/links.json',
  
  // Privacy Cash Relayer (for reference, not used by backend)
  RELAYER_URL: process.env.RELAYER_URL || 'https://api3.privacycash.org',
};

/**
 * Privacy Cash SDK Configuration
 * Backend server-side operations configuration
 */
export const PRIVACY_CASH_CONFIG = {
  // RPC Configuration for on-chain operations
  rpcUrl: process.env.SOLANA_RPC_URL || config.SOLANA_RPC_URL,

  // Operator configuration (backend acts as relayer/operator)
  operatorSecretKey: process.env.OPERATOR_SECRET_KEY,

  // Privacy Cash Program ID
  programId: process.env.PRIVACY_CASH_PROGRAM || '9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD',

  // Debug mode
  enableDebug: config.ENABLE_DEBUG,

  // Withdrawal configuration
  withdrawal: {
    // Base fee charged per withdrawal
    baseFee: 0.006, // SOL
    // Protocol fee percentage
    protocolFeePercentage: 0.0035, // 0.35%
    // Minimum withdrawal amount
    minAmount: 0.001, // SOL
    // Maximum withdrawal amount
    maxAmount: 100, // SOL
  },

  // Transaction monitoring configuration
  monitoring: {
    // Maximum retries for transaction confirmation
    maxRetries: 10,
    // Delay between confirmation checks (ms)
    delayMs: 3_000,
  },

  // Operator wallet configuration
  operator: {
    // Minimum balance to maintain
    minBalance: 0.1, // SOL
    // Recommended balance for operations
    recommendedBalance: 1.0, // SOL
  },
};

/**
 * Validate Privacy Cash configuration
 */
export function validatePrivacyCashConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!PRIVACY_CASH_CONFIG.operatorSecretKey) {
    errors.push('OPERATOR_SECRET_KEY environment variable is required');
  }

  if (!PRIVACY_CASH_CONFIG.rpcUrl) {
    errors.push('SOLANA_RPC_URL environment variable is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

