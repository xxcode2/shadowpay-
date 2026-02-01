/**
 * Privacy Cash Client - Non-Custodial Flow for Browser
 * 
 * ⚠️ CRITICAL: The Privacy Cash SDK requires a private key for full operation,
 * but in a browser context we CANNOT and SHOULD NOT transmit the user's private key.
 * 
 * This service would need one of the following approaches:
 * 1. Fetch operator keypair from backend (non-custodial flow - deposits only)
 * 2. Implement executeNonCustodialDeposit wrapper (best for Phantom wallet)
 * 3. Use backend API for private operations (server-side custodial)
 * 
 * For now, returning proper error messages and type stubs.
 */

import { Connection, PublicKey, VersionedTransaction, Keypair } from '@solana/web3.js'

export interface DepositOptions {
  lamports: number
  connection: Connection
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
    signMessage(message: Uint8Array): Promise<Uint8Array>
  }
  recipientAddress?: string
  onProgress?: (message: string) => void
}

export interface WithdrawOptions {
  lamports: number
  recipientAddress?: string
  connection: Connection
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
    signMessage(message: Uint8Array): Promise<Uint8Array>
  }
  onProgress?: (message: string) => void
}

export interface DepositResult {
  tx: string
  lamports: number
}

export interface WithdrawResult {
  tx: string
  recipient: string
  amount_in_lamports: number
  fee_in_lamports: number
  isPartial: boolean
}

const log = (msg: string) => {
  console.log(`[PrivacyCash] ${msg}`)
}

/**
 * Deposit using operator keypair (from backend)
 * This is the non-custodial pattern: operator acts on behalf of user
 */
async function getOperatorKeypair(): Promise<Keypair> {
  try {
    const response = await fetch('/api/operator-keypair')
    if (!response.ok) throw new Error(`Failed to fetch operator keypair: ${response.statusText}`)
    
    const { seed } = await response.json()
    if (!seed) throw new Error('No keypair seed in response')
    
    // Decode base64 seed
    const seedBytes = Buffer.from(seed, 'base64')
    return Keypair.fromSecretKey(seedBytes)
  } catch (error) {
    throw new Error(`Operator keypair error: ${error}`)
  }
}

/**
 * Deposit SOL to Privacy Cash
 * Uses operator keypair from backend for non-custodial flow
 */
export async function depositToPrivacyCash(options: DepositOptions): Promise<DepositResult> {
  const { lamports, connection, wallet, recipientAddress, onProgress } = options

  const progress = (msg: string) => {
    log(msg)
    onProgress?.(msg)
  }

  try {
    progress(`📥 Depositing ${(lamports / 1e9).toFixed(6)} SOL...`)
    
    // @ts-ignore - SDK module resolution
    const { PrivacyCash } = await import('privacycash')
    
    progress(`🔑 Fetching operator keypair...`)
    const operatorKeypair = await getOperatorKeypair()

    // ✅ CORRECT: Initialize with operator keypair (private key from backend)
    progress(`🔐 Initializing Privacy Cash SDK...`)
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,  // Operator's keypair for non-custodial flow
      enableDebug: false
    })

    progress(`💾 Submitting to relayer...`)
    progress(`⏳ ZK proof generation: 30-60 seconds...`)

    // Call deposit with just lamports
    const result = await client.deposit({ lamports })

    progress(`✅ Deposit confirmed!`)
    progress(`📤 Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      lamports
    }

  } catch (error: any) {
    const msg = error?.message || String(error)
    log(`❌ Deposit error: ${msg}`)

    // Better error messages
    if (msg.includes('Insufficient')) {
      throw new Error('Not enough SOL in wallet')
    } else if (msg.includes('rejected')) {
      throw new Error('Transaction rejected by wallet')
    } else if (msg.includes('RPC')) {
      throw new Error('Network error - RPC connection failed')
    } else if (msg.includes('Path') || msg.includes('circuit')) {
      throw new Error('Circuit files not found - check /public/circuits/')
    } else if (msg.includes('Operator keypair')) {
      throw new Error('Backend operator keypair unavailable - check /api/operator-keypair')
    }

    throw new Error(`Deposit failed: ${msg}`)
  }
}

/**
 * Withdraw SOL from Privacy Cash
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, connection, wallet, recipientAddress, onProgress } = options
  const recipient = recipientAddress || wallet.publicKey.toString()

  const progress = (msg: string) => {
    log(msg)
    onProgress?.(msg)
  }

  try {
    progress(`📤 Withdrawing ${(lamports / 1e9).toFixed(6)} SOL...`)
    progress(`📍 To: ${recipient}`)

    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')

    progress(`🔑 Fetching operator keypair...`)
    const operatorKeypair = await getOperatorKeypair()

    progress(`🔐 Initializing Privacy Cash SDK...`)
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false
    })

    progress(`💳 Submitting to relayer...`)
    progress(`⏳ ZK proof generation: 30-60 seconds...`)

    const result = await client.withdraw({
      lamports,
      recipientAddress: recipient
    })

    progress(`✅ Withdrawal confirmed!`)
    progress(`📤 Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      recipient,
      amount_in_lamports: lamports,
      fee_in_lamports: 0,
      isPartial: false
    }

  } catch (error: any) {
    const msg = error?.message || String(error)
    log(`❌ Withdrawal error: ${msg}`)
    throw new Error(`Withdrawal failed: ${msg}`)
  }
}

/**
 * Get private balance
 */
export async function getPrivateBalance(
  connection: Connection,
  wallet?: { publicKey: PublicKey }
): Promise<number> {
  try {
    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')

    const operatorKeypair = await getOperatorKeypair()

    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false
    })

    const balance = await client.getPrivateBalance()

    if (typeof balance === 'number') return balance
    return balance?.lamports || 0

  } catch (error) {
    log(`⚠️ Error reading balance: ${error}`)
    return 0
  }
}
