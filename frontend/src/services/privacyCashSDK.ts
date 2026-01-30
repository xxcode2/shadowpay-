/**
 * ✅ PRIVACY CASH SDK UTILITIES - Direct SDK Integration
 * 
 * Low-level Privacy Cash SDK functions
 * Used by linkAPI.ts under the hood
 * 
 * For ShadowPay integration, use linkAPI.ts instead!
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'

/**
 * Load circuits from public folder
 */
export async function loadCircuits(): Promise<{
  wasm: Uint8Array
  zkey: Uint8Array
}> {
  const wasmResponse = await fetch('/circuits/transaction2.wasm')
  const zkeyResponse = await fetch('/circuits/transaction2.zkey')

  if (!wasmResponse.ok || !zkeyResponse.ok) {
    throw new Error('Failed to load circuits')
  }

  const wasm = new Uint8Array(await wasmResponse.arrayBuffer())
  const zkey = new Uint8Array(await zkeyResponse.arrayBuffer())

  return { wasm, zkey }
}

/**
 * Initialize Privacy Cash SDK
 */
export function initializePrivacyCash(input: {
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
  rpcUrl?: string
}): PrivacyCash {
  const rpcUrl = input.rpcUrl || process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  
  return new PrivacyCash({
    RPC_url: rpcUrl,
    owner: input.wallet as any,
  })
}

/**
 * Deposit to Privacy Cash
 */
export async function deposit(input: {
  amount: number
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
}): Promise<{
  tx: string
  amount: number
  lamports: number
}> {
  console.log(`💸 Depositing ${input.amount} SOL...`)
  
  const pc = initializePrivacyCash({ wallet: input.wallet })
  const lamports = Math.round(input.amount * LAMPORTS_PER_SOL)
  
  const result = await pc.deposit({ lamports })
  
  console.log(`✅ Deposit successful: ${result.tx}`)
  
  return {
    tx: result.tx,
    amount: input.amount,
    lamports,
  }
}

/**
 * Withdraw from Privacy Cash
 */
export async function withdraw(input: {
  amount: number
  recipientAddress: string
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
}): Promise<{
  tx: string
  recipient: string
  amount: number
  lamports: number
}> {
  console.log(`📤 Withdrawing ${input.amount} SOL...`)
  
  const pc = initializePrivacyCash({ wallet: input.wallet })
  const lamports = Math.round(input.amount * LAMPORTS_PER_SOL)
  
  const result = await pc.withdraw({
    lamports,
    recipientAddress: input.recipientAddress,
  })
  
  console.log(`✅ Withdrawal successful: ${result.tx}`)
  
  return {
    tx: result.tx,
    recipient: input.recipientAddress,
    amount: input.amount,
    lamports,
  }
}

/**
 * Get private balance from Privacy Cash
 */
export async function getPrivateBalance(input: {
  wallet: {
    publicKey: PublicKey
    signTransaction: (tx: any) => Promise<any>
    signAllTransactions: (txs: any[]) => Promise<any[]>
  }
}): Promise<{
  lamports: number
  sol: number
}> {
  const pc = initializePrivacyCash({ wallet: input.wallet })
  const balance = await pc.getPrivateBalance()
  
  return {
    lamports: balance.lamports || 0,
    sol: (balance.lamports || 0) / LAMPORTS_PER_SOL,
  }
}

/**
 * Export for use in components
 */
export const PrivacyCashSDK = {
  loadCircuits,
  initializePrivacyCash,
  deposit,
  withdraw,
  getPrivateBalance,
}

