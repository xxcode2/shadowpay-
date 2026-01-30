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
import { PrivacyCash } from 'privacycash'

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

  const rpcUrl = input.rpcUrl || process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  console.log(`📦 Initializing PrivacyCash client...`)
  const pc = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: input.wallet as any,
  })

  console.log(`📦 Loading circuits...`)
  // Circuits already loaded globally, just deposit

  const token = SUPPORTED_TOKENS[input.assetType]
  const baseUnits = Math.round(input.amount * token.units)

  console.log(`💸 Depositing to Privacy Cash pool...`)
  console.log(`   Amount: ${input.amount} ${input.assetType}`)

  let result

  if (input.assetType === 'SOL') {
    result = await pc.deposit({ lamports: baseUnits })
  } else {
    // For SPL tokens
    const token = SUPPORTED_TOKENS[input.assetType]
    const mint = (token as any).mint
    if (!mint) throw new Error(`Token ${input.assetType} not supported`)
    
    const mintKey = new PublicKey(mint)
    result = await pc.depositSPL({
      mintAddress: mintKey,
      base_units: baseUnits,
    })
  }

  console.log(`✅ Deposit successful!`)
  console.log(`   TX: ${result.tx}`)

  // Record on backend
  const response = await fetch(`${getApiUrl()}/api/savings/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: input.wallet.publicKey.toString(),
      assetType: input.assetType,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ Init failed:', error)
    throw new Error(error.error || 'Failed to initialize savings account')
  }

  // Now record the deposit
  const depositRes = await fetch(`${getApiUrl()}/api/savings/${input.wallet.publicKey.toString()}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: baseUnits,
      assetType: input.assetType,
      transactionHash: result.tx,
      memo: 'ShadowPay saving',
    }),
  })

  if (!depositRes.ok) {
    const error = await depositRes.json()
    console.error('❌ Deposit record failed:', error)
    throw new Error(error.error || 'Failed to record deposit')
  }

  return {
    transactionHash: result.tx,
    amount: input.amount.toString(),
    assetType: input.assetType,
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

  const rpcUrl = input.rpcUrl || process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  console.log(`📦 Initializing PrivacyCash client...`)
  const pc = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: input.wallet as any,
  })

  const token = SUPPORTED_TOKENS[input.assetType]
  const baseUnits = Math.round(input.amount * token.units)

  console.log(`🔐 Withdrawing from Privacy Cash pool...`)
  console.log(`   Amount: ${input.amount} ${input.assetType}`)
  console.log(`   To: ${input.recipientAddress}`)

  let result

  if (input.assetType === 'SOL') {
    result = await pc.withdraw({
      lamports: baseUnits,
      recipientAddress: input.recipientAddress,
    })
  } else {
    const tokenConfig = SUPPORTED_TOKENS[input.assetType]
    const mint = (tokenConfig as any).mint
    if (!mint) throw new Error(`Token ${input.assetType} not supported`)
    
    const mintKey = new PublicKey(mint)
    result = await pc.withdrawSPL({
      mintAddress: mintKey,
      amount: input.amount,
      recipientAddress: input.recipientAddress, // Not 'recipient'
    })
  }

  console.log(`✅ Send successful!`)
  console.log(`   TX: ${result.tx}`)
  const receivedAmount = (result as any).amount_in_lamports || (result as any).base_units || input.amount
  console.log(`   Recipient received: ${receivedAmount} ${input.assetType}`)

  // Record on backend
  const response = await fetch(
    `${getApiUrl()}/api/savings/${input.wallet.publicKey.toString()}/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toAddress: input.recipientAddress,
        amount: baseUnits,
        assetType: input.assetType,
        transactionHash: result.tx,
        memo: input.memo || 'ShadowPay send',
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ Send record failed:', error)
    throw new Error(error.error || 'Failed to record send transaction')
  }

  return {
    transactionHash: result.tx,
    recipient: input.recipientAddress,
    amount: input.amount.toString(),
    assetType: input.assetType,
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

  const rpcUrl = input.rpcUrl || process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  console.log(`📦 Initializing PrivacyCash client...`)
  const pc = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: input.wallet as any,
  })

  const token = SUPPORTED_TOKENS[input.assetType]
  const baseUnits = Math.round(input.amount * token.units)

  console.log(`🔓 Unshielding from Privacy Cash pool...`)

  let result

  if (input.assetType === 'SOL') {
    result = await pc.withdraw({
      lamports: baseUnits,
      recipientAddress: input.wallet.publicKey.toString(),
    })
  } else {
    const tokenConfig = SUPPORTED_TOKENS[input.assetType]
    const mint = (tokenConfig as any).mint
    if (!mint) throw new Error(`Token ${input.assetType} not supported`)
    
    const mintKey = new PublicKey(mint)
    result = await pc.withdrawSPL({
      mintAddress: mintKey,
      amount: input.amount,
      recipientAddress: input.wallet.publicKey.toString(),
    })
  }

  console.log(`✅ Withdrawal successful!`)
  console.log(`   TX: ${result.tx}`)

  // Record on backend
  const response = await fetch(`${getApiUrl()}/api/savings/${input.wallet.publicKey.toString()}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: baseUnits,
      assetType: input.assetType,
      transactionHash: result.tx,
      memo: input.memo || 'ShadowPay withdrawal',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ Withdraw record failed:', error)
    throw new Error(error.error || 'Failed to record withdrawal')
  }

  return {
    transactionHash: result.tx,
    amount: input.amount.toString(),
    assetType: input.assetType,
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
  const rpcUrl = input.rpcUrl || process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  const pc = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: input.wallet as any,
  })

  const token = SUPPORTED_TOKENS[input.assetType]

  let result

  console.log(`🔍 Checking private balance...`)

  if (input.assetType === 'SOL') {
    result = await pc.getPrivateBalance()
    const balance = result.lamports / token.units
    return {
      balance,
      assetType: input.assetType,
      displayBalance: `≈ ${balance.toFixed(4)} ${input.assetType}`,
    }
  } else {
    const tokenConfig = SUPPORTED_TOKENS[input.assetType]
    const mint = (tokenConfig as any).mint
    if (!mint) throw new Error(`Token ${input.assetType} not supported`)
    
    const mintKey = new PublicKey(mint)
    result = await pc.getPrivateBalanceSpl(mintKey)
    const balance = (result as any).amount / token.units
    return {
      balance,
      assetType: input.assetType,
      displayBalance: `≈ ${balance.toFixed(2)} ${input.assetType}`,
    }
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
