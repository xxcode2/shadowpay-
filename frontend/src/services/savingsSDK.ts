/**
 * 💰 SHADOWPAY SAVINGS SERVICE
 *
 * Main SDK for ShadowPay savings:
 * - Deposit to Privacy Cash
 * - Send to other addresses
 * - Withdraw to own wallet
 * - Auto-deposit management
 * - Savings goals
 * - Multi-currency support
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

// Token config
export const SUPPORTED_TOKENS = {
  SOL: {
    name: 'SOL',
    decimals: 9,
    units: 1e9,
    icon: '◎',
  },
  USDC: {
    name: 'USDC',
    decimals: 6,
    units: 1e6,
    icon: '$',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  USDT: {
    name: 'USDT',
    decimals: 6,
    units: 1e6,
    icon: '$',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  ZEC: {
    name: 'ZEC',
    decimals: 8,
    units: 1e8,
    icon: 'ⓩ',
    mint: 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
  },
  ORE: {
    name: 'ORE',
    decimals: 11,
    units: 1e11,
    icon: '⛏',
    mint: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
  },
  STORE: {
    name: 'STORE',
    decimals: 11,
    units: 1e11,
    icon: '🏪',
    mint: 'sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH',
  },
}

// ═══════════════════════════════════════════════════════════
// INIT ACCOUNT
// ═══════════════════════════════════════════════════════════

export async function initAccount(walletAddress: string, assetType: string = 'SOL'): Promise<void> {
  try {
    const apiUrl = getApiUrl()
    await fetch(`${apiUrl}/api/savings/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, assetType }),
    })
  } catch (err) {
    console.log('Account already initialized or error:', err)
  }
}

// ═══════════════════════════════════════════════════════════
// DEPOSIT (SAVING)
// ═══════════════════════════════════════════════════════════

export async function depositToSavings(input: {
  amount: number // in units (0.01 for SOL = 0.01 SOL, 2 for USDC = 2 USDC)
  assetType: keyof typeof SUPPORTED_TOKENS
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
  rpcUrl?: string
}): Promise<{
  transactionHash: string
  amount: string
  assetType: string
}> {
  console.log(`\n💰 SAVING ${input.amount} ${input.assetType}`)

  const walletAddress = input.wallet.publicKey.toString()
  const token = SUPPORTED_TOKENS[input.assetType]
  const baseUnits = Math.round(input.amount * token.units)

  try {
    // Step 1: Initialize savings account on backend
    console.log(`📌 Initializing savings account...`)
    const initRes = await fetch(`${getApiUrl()}/api/savings/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        assetType: input.assetType,
      }),
    })

    if (!initRes.ok) {
      const error = await initRes.json()
      console.error('❌ Init failed:', error)
      throw new Error(error.error || 'Failed to initialize savings account')
    }

    console.log(`✅ Savings account ready`)

    // Step 2: Call backend to execute deposit with PrivacyCash
    console.log(`💸 Requesting deposit from backend...`)
    console.log(`   Amount: ${input.amount} ${input.assetType}`)
    
    const depositRes = await fetch(`${getApiUrl()}/api/savings/${walletAddress}/execute-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: baseUnits,
        assetType: input.assetType,
      }),
    })

    if (!depositRes.ok) {
      const error = await depositRes.json()
      console.error('❌ Deposit failed:', error)
      throw new Error(error.error || 'Deposit failed on backend')
    }

    const result = await depositRes.json()
    console.log(`✅ Deposit successful!`)
    console.log(`   TX: ${result.transactionHash}`)

    return {
      transactionHash: result.transactionHash,
      amount: input.amount.toString(),
      assetType: input.assetType,
    }
  } catch (err: any) {
    console.error('❌ Deposit error:', err.message)
    throw err
  }
}

// ═══════════════════════════════════════════════════════════
// SEND (Withdraw to other address)
// ═══════════════════════════════════════════════════════════

export async function sendFromSavings(input: {
  amount: number
  assetType: keyof typeof SUPPORTED_TOKENS
  recipientAddress: string
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
  memo?: string
  rpcUrl?: string
}): Promise<{
  transactionHash: string
  recipient: string
  amount: string
  assetType: string
}> {
  console.log(`\n📤 SENDING ${input.amount} ${input.assetType} to ${input.recipientAddress}`)

  // Validate recipient
  try {
    new PublicKey(input.recipientAddress)
  } catch {
    throw new Error('Invalid recipient address')
  }

  const walletAddress = input.wallet.publicKey.toString()
  const token = SUPPORTED_TOKENS[input.assetType]
  const baseUnits = Math.round(input.amount * token.units)

  try {
    // Call backend to execute withdrawal with PrivacyCash
    console.log(`📤 Requesting withdrawal from backend...`)
    console.log(`   Amount: ${input.amount} ${input.assetType}`)
    console.log(`   To: ${input.recipientAddress}`)
    
    const withdrawRes = await fetch(`${getApiUrl()}/api/savings/${walletAddress}/execute-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toAddress: input.recipientAddress,
        amount: baseUnits,
        assetType: input.assetType,
        memo: input.memo || 'ShadowPay send',
      }),
    })

    if (!withdrawRes.ok) {
      const error = await withdrawRes.json()
      console.error('❌ Send failed:', error)
      throw new Error(error.error || 'Send failed on backend')
    }

    const result = await withdrawRes.json()
    console.log(`✅ Send successful!`)
    console.log(`   TX: ${result.transactionHash}`)

    return {
      transactionHash: result.transactionHash,
      recipient: input.recipientAddress,
      amount: input.amount.toString(),
      assetType: input.assetType,
    }
  } catch (err: any) {
    console.error('❌ Send error:', err.message)
    throw err
  }
}

// ═══════════════════════════════════════════════════════════
// WITHDRAW (To own wallet)
// ═══════════════════════════════════════════════════════════

export async function withdrawFromSavings(input: {
  amount: number
  assetType: keyof typeof SUPPORTED_TOKENS
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
  memo?: string
  rpcUrl?: string
}): Promise<{
  transactionHash: string
  amount: string
  assetType: string
}> {
  console.log(`\n⬆️ WITHDRAWING ${input.amount} ${input.assetType} to own wallet`)

  const walletAddress = input.wallet.publicKey.toString()
  const token = SUPPORTED_TOKENS[input.assetType]
  const baseUnits = Math.round(input.amount * token.units)

  try {
    // Call backend to execute withdrawal with PrivacyCash
    console.log(`⬆️ Requesting withdrawal from backend...`)
    
    const withdrawRes = await fetch(`${getApiUrl()}/api/savings/${walletAddress}/execute-withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: baseUnits,
        assetType: input.assetType,
        memo: input.memo || 'ShadowPay withdrawal',
      }),
    })

    if (!withdrawRes.ok) {
      const error = await withdrawRes.json()
      console.error('❌ Withdrawal failed:', error)
      throw new Error(error.error || 'Withdrawal failed on backend')
    }

    const result = await withdrawRes.json()
    console.log(`✅ Withdrawal successful!`)
    console.log(`   TX: ${result.transactionHash}`)

    return {
      transactionHash: result.transactionHash,
      amount: input.amount.toString(),
      assetType: input.assetType,
    }
  } catch (err: any) {
    console.error('❌ Withdrawal error:', err.message)
    throw err
  }
}

// ═══════════════════════════════════════════════════════════
// GET BALANCE
// ═══════════════════════════════════════════════════════════

export async function getPrivateBalance(input: {
  assetType: keyof typeof SUPPORTED_TOKENS
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
  rpcUrl?: string
}): Promise<{
  balance: number
  assetType: string
  displayBalance: string
}> {
  const walletAddress = input.wallet.publicKey.toString()
  const token = SUPPORTED_TOKENS[input.assetType]

  try {
    // Call backend to get balance
    console.log(`🔍 Checking private balance via backend...`)

    const res = await fetch(`${getApiUrl()}/api/savings/${walletAddress}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetType: input.assetType }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to check balance')
    }

    const result = await res.json()
    const balance = result.balance / token.units

    return {
      balance,
      assetType: input.assetType,
      displayBalance: `≈ ${balance.toFixed(4)} ${input.assetType}`,
    }
  } catch (err: any) {
    console.error('❌ Balance check error:', err.message)
    throw err
  }
}

// ═══════════════════════════════════════════════════════════
// GET PROFILE
// ═══════════════════════════════════════════════════════════

export async function getSavingsProfile(walletAddress: string): Promise<any> {
  const response = await fetch(`${getApiUrl()}/api/savings/${walletAddress}`)

  if (!response.ok) {
    throw new Error('Savings account not found')
  }

  return response.json()
}

// ═══════════════════════════════════════════════════════════
// AUTO-DEPOSIT
// ═══════════════════════════════════════════════════════════

export async function createAutoDeposit(input: {
  walletAddress: string
  frequency: 'daily' | 'weekly' | 'monthly'
  amount: number
  assetType: keyof typeof SUPPORTED_TOKENS
}): Promise<{
  id: string
  frequency: string
  amount: string
  assetType: string
}> {
  const response = await fetch(
    `${getApiUrl()}/api/savings/${input.walletAddress}/auto-deposit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )

  if (!response.ok) {
    throw new Error('Failed to create auto-deposit')
  }

  return response.json()
}

export async function updateAutoDeposit(input: {
  walletAddress: string
  autoDepositId: string
  frequency?: 'daily' | 'weekly' | 'monthly'
  amount?: number
  enabled?: boolean
}): Promise<any> {
  const response = await fetch(
    `${getApiUrl()}/api/savings/${input.walletAddress}/auto-deposit/${input.autoDepositId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )

  if (!response.ok) {
    throw new Error('Failed to update auto-deposit')
  }

  return response.json()
}

export async function deleteAutoDeposit(walletAddress: string, autoDepositId: string): Promise<void> {
  const response = await fetch(
    `${getApiUrl()}/api/savings/${walletAddress}/auto-deposit/${autoDepositId}`,
    { method: 'DELETE' }
  )

  if (!response.ok) {
    throw new Error('Failed to delete auto-deposit')
  }
}

// ═══════════════════════════════════════════════════════════
// SAVINGS GOALS
// ═══════════════════════════════════════════════════════════

export async function createGoal(input: {
  walletAddress: string
  name: string
  targetAmount: number
  deadline?: string
  emoji?: string
  color?: string
}): Promise<any> {
  const response = await fetch(`${getApiUrl()}/api/savings/${input.walletAddress}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('Failed to create goal')
  }

  return response.json()
}

export async function deleteGoal(walletAddress: string, goalId: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/savings/${walletAddress}/goals/${goalId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete goal')
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function getApiUrl(): string {
  // Use Railway backend URL for API calls
  return import.meta.env.VITE_BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'
}

export const SavingsSDK = {
  initAccount,
  depositToSavings,
  sendFromSavings,
  withdrawFromSavings,
  getPrivateBalance,
  getSavingsProfile,
  createAutoDeposit,
  updateAutoDeposit,
  deleteAutoDeposit,
  createGoal,
  deleteGoal,
  SUPPORTED_TOKENS,
}
