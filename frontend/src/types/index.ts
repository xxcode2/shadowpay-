import { PublicKey } from '@solana/web3.js'

/**
 * ShadowPay Type Definitions
 */

// ============= WALLET TYPES =============
export interface Wallet {
  publicKey: PublicKey
  connected: boolean
  signMessage(message: Uint8Array): Promise<Uint8Array>
  signTransaction<T extends { [key: string]: any }>(transaction: T): Promise<T>
  // Add other wallet methods as needed
}

// ============= LINK TYPES =============
export interface PaymentLink {
  id: string
  amount: number // in lamports for SOL, base units for tokens
  assetType: 'SOL' | 'USDC' | 'USDT'
  claimed: boolean
  claimedBy: string | null // recipient wallet address
  depositTx: string // transaction hash from deposit
  withdrawTx: string | null // transaction hash from withdrawal
  createdAt: Date
  updatedAt: Date
}

export interface CreateLinkPayload {
  amount: number
  assetType: 'SOL' | 'USDC' | 'USDT'
}

// ============= TRANSACTION TYPES =============
export interface Transaction {
  id: string
  type: 'deposit' | 'withdraw'
  status: 'pending' | 'confirmed' | 'failed'
  amount: number
  assetType: string
  transactionHash: string
  fromAddress?: string
  toAddress?: string
  linkId: string
  createdAt: Date
  updatedAt: Date
}

// ============= PRIVACY CASH TYPES =============
export interface DepositResult {
  tx: string // transaction signature
}

export interface WithdrawResult {
  tx: string // transaction signature
  recipient: string // recipient wallet address
  amount_in_lamports: number // amount received after fees
  fee_in_lamports: number // fee paid
  isPartial: boolean // true if balance was insufficient
}

export interface BalanceResult {
  lamports: number // balance in lamports
}

// ============= API RESPONSE TYPES =============
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface CreateLinkResponse extends ApiResponse {
  linkId: string
  amount: number
  assetType: string
  shareUrl: string
}

export interface DepositResponse extends ApiResponse {
  linkId: string
  depositTx: string
  message: string
}

export interface ClaimLinkResponse extends ApiResponse {
  linkId: string
  claimedBy: string
  withdrawTx: string
  amount: number
  assetType: string
  message: string
}

// ============= STATE TYPES =============
export type FlowState = 'idle' | 'loading' | 'success' | 'error'

export interface DepositFlowState {
  state: FlowState
  linkId?: string
  depositTx?: string
  error?: string
}

export interface ClaimFlowState {
  state: FlowState
  withdrawTx?: string
  amountReceived?: number
  error?: string
}
