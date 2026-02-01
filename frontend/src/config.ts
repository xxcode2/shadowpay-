/**
 * ShadowPay Configuration
 * Environment variables and constants
 */

export const CONFIG = {
  // APIs
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app',
  // Use free public RPC endpoints (no API key required)
  // Fallback order: api.mainnet-beta.solana.com → api.rpcpool.com
  SOLANA_RPC_URL: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',

  // UI
  SHARE_BASE_URL: import.meta.env.VITE_SHARE_BASE_URL || 'https://shadowpayy.vercel.app',

  // Deposit defaults
  DEFAULT_ASSET_TYPE: 'SOL' as const,
  SUPPORTED_ASSETS: ['SOL', 'USDC', 'USDT'] as const,

  // Privacy Cash Pool (Official Smart Contract Address)
  // Verified on Solscan: https://solscan.io/token/PrivacyCashTokenAddress
  PRIVACY_CASH_POOL: import.meta.env.VITE_PRIVACY_CASH_POOL || '9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD',
  PRIVACY_CASH_MESSAGE: 'Privacy Money account sign in',

  // Timeouts
  DEPOSIT_TIMEOUT_MS: 60000, // 1 minute
  WITHDRAW_TIMEOUT_MS: 60000, // 1 minute
  BALANCE_CHECK_TIMEOUT_MS: 30000, // 30 seconds
}

export type AssetType = (typeof CONFIG.SUPPORTED_ASSETS)[number]
