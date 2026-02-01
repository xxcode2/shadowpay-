/**
 * Privacy Cash Client Wrapper
 * Simplified interface using the official Privacy Cash SDK
 * 
 * ✅ CORRECT IMPLEMENTATION - Uses connection + wallet directly
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
 * Deposit SOL to Privacy Cash
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
    
    // ✅ SDK requires RPC_url and owner (keypair)
    // For browser wallets, we use wallet's public key as owner
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: wallet.publicKey.toBuffer(),
      enableDebug: false
    })

    log(`Depositing ${(lamports / 1e9).toFixed(6)} SOL to Privacy Cash pool...`)
    log(`This may take 30-60 seconds for ZK proof generation...`)
    
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
      throw new Error('Deposit amount exceeds protocol limit')
    } else if (errorMsg.includes('response not ok') || errorMsg.includes('RPC')) {
      throw new Error('Network error - check RPC connection')
    } else if (errorMsg.includes('User rejected')) {
      throw new Error('Transaction rejected by wallet')
    }
    
    throw new Error(`Deposit failed: ${errorMsg}`)
  }
}

/**
 * Withdraw SOL from Privacy Cash
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, connection, wallet, recipientAddress, onProgress } = options
  const recipient = recipientAddress || wallet.publicKey.toString()

  const log = (msg: string) => {
    console.log(`[PrivacyCash Withdraw] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // @ts-ignore - SDK module resolution
    const { PrivacyCash } = await import('privacycash')
    
    log(`Initializing Privacy Cash client...`)
    
    // ✅ SDK requires RPC_url and owner (keypair)
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: wallet.publicKey.toBuffer(),
      enableDebug: false
    })

    log(`Withdrawing ${(lamports / 1e9).toFixed(6)} SOL from Privacy Cash pool...`)
    log(`To: ${recipient}`)
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
      throw new Error('Not enough private balance to withdraw')
    } else if (errorMsg.includes('Invalid recipient')) {
      throw new Error('Invalid recipient wallet address')
    } else if (errorMsg.includes('User rejected')) {
      throw new Error('Transaction rejected by wallet')
    }
    
    throw new Error(`Withdrawal failed: ${errorMsg}`)
  }
}

/**
 * Get private balance in Privacy Cash
 */
export async function getPrivateBalance(connection: Connection, wallet?: { publicKey: PublicKey }): Promise<number> {
  try {
    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')
    
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: wallet?.publicKey.toBuffer() || new Uint8Array(32),
      enableDebug: false
    })

    const balance = await client.getPrivateBalance()
    
    if (typeof balance === 'number') return balance
    return balance?.lamports || 0

  } catch (error) {
    console.log(`[PrivacyCash Balance] ⚠️ Error reading balance:`, error)
    return 0
  }
}
