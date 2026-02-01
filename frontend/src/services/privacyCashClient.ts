/**
 * Privacy Cash Client Wrapper
 * Simplified interface using the official Privacy Cash SDK
 * 
 * Official docs: https://docs.privacycash.org/sdk
 * 
 * @ts-ignore - Suppressing type errors for dynamic SDK import
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'

export interface DepositOptions {
  lamports: number
  connection: Connection
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
  }
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

/**
 * Deposit to Privacy Cash using the official SDK
 * Simple wrapper that handles the complexity internally
 */
export async function depositToPrivacyCash(options: DepositOptions): Promise<DepositResult> {
  const { lamports, connection, wallet, onProgress } = options

  const log = (msg: string) => {
    console.log(`[PrivacyCash Deposit] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // @ts-ignore - SDK module resolution
    const { PrivacyCash } = await import('privacycash')
    
    log(`Initializing Privacy Cash client...`)
    
    // ✅ For browser wallets, SDK needs connection + wallet for signing
    const client = new PrivacyCash({
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction
      }
    })

    log(`Depositing ${(lamports / 1e9).toFixed(6)} SOL to Privacy Cash pool...`)
    log(`This may take 30-60 seconds for ZK proof generation...`)
    
    // ✅ Call the official SDK deposit method
    const result = await client.deposit({
      lamports
    })

    log(`✅ Deposit successful!`)
    log(`Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      lamports
    }
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`[PrivacyCash Deposit] ❌ Failed:`, errorMsg)
    
    if (errorMsg.includes('Insufficient balance')) {
      throw new Error('Not enough SOL in wallet to deposit')
    } else if (errorMsg.includes("Don't deposit more than")) {
      throw new Error('Deposit amount exceeds maximum limit')
    } else if (errorMsg.includes('rejected')) {
      throw new Error('Transaction rejected by wallet')
    } else if (errorMsg.includes('RPC')) {
      throw new Error('Network error - RPC connection failed')
    }

    throw new Error(`Deposit failed: ${errorMsg}`)
  }
}

/**
 * Withdraw from Privacy Cash using the official SDK
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, recipientAddress, connection, wallet, onProgress } = options
  const recipient = recipientAddress || wallet.publicKey.toString()

  const log = (msg: string) => {
    console.log(`[PrivacyCash Withdraw] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')
    
    log(`Initializing Privacy Cash client...`)
    
    const client = new PrivacyCash({
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signMessage: wallet.signMessage
      }
    })

    log(`Withdrawing ${(lamports / 1e9).toFixed(6)} SOL from Privacy Cash pool...`)
    log(`Recipient: ${recipient}`)
    log(`This may take 30-60 seconds for ZK proof generation...`)
    
    const result = await client.withdraw({
      lamports,
      recipientAddress: recipient
    })

    log(`✅ Withdrawal successful!`)
    log(`Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      recipient,
      amount_in_lamports: lamports,
      fee_in_lamports: 0,
      isPartial: false
    }
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`[PrivacyCash Withdraw] ❌ Failed:`, errorMsg)
    
    if (errorMsg.includes('Insufficient')) {
      throw new Error('Not enough balance in private account')
    } else if (errorMsg.includes('rejected')) {
      throw new Error('Transaction rejected by wallet')
    } else if (errorMsg.includes('RPC')) {
      throw new Error('Network error - RPC connection failed')
    }

    throw new Error(`Withdrawal failed: ${errorMsg}`)
  }
}

/**
 * Get private balance
 */
export async function getPrivateBalance(
  connection: Connection,
  wallet: { publicKey: PublicKey; signMessage(message: Uint8Array): Promise<Uint8Array> }
): Promise<number> {
  try {
    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')

    const client = new PrivacyCash({
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signMessage: wallet.signMessage
      }
    })

    const balance = await client.getPrivateBalance()

    if (typeof balance === 'number') return balance
    return balance?.lamports || 0

  } catch (error) {
    console.log(`[PrivacyCash] ⚠️ Could not fetch balance:`, error)
    return 0
  }
}
