/**
 * Wallet Manager - Unified wallet adapter interface
 * Handles connection to Phantom and other wallets using @solana/wallet-adapter
 */

import { PublicKey, Connection } from '@solana/web3.js'
import {
  WalletAdapter,
  WalletNotConnectedError,
  type WalletName,
} from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'

/**
 * Unified wallet interface that works with vanilla JS
 */
export interface UnifiedWallet {
  publicKey: PublicKey | null
  connected: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendTransaction(transaction: any, connection: Connection): Promise<string>
  signTransaction(transaction: any): Promise<any>
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

class WalletManager {
  private adapter: WalletAdapter | null = null
  private listeners: Set<(connected: boolean) => void> = new Set()

  constructor() {
    // Initialize Phantom adapter
    this.adapter = new PhantomWalletAdapter()
    
    // Listen for changes
    if (this.adapter) {
      this.adapter.on('connect', () => {
        console.log('Wallet connected:', this.adapter?.publicKey?.toString())
        this.notifyListeners()
      })
      this.adapter.on('disconnect', () => {
        console.log('Wallet disconnected')
        this.notifyListeners()
      })
    }
  }

  /**
   * Get the unified wallet interface
   */
  getWallet(): UnifiedWallet {
    if (!this.adapter) {
      throw new Error('Wallet adapter not initialized')
    }

    return {
      publicKey: this.adapter.publicKey,
      connected: this.adapter.connected,

      async connect() {
        if (!this.adapter) throw new Error('Wallet not initialized')
        try {
          await this.adapter.connect()
        } catch (err: any) {
          console.error('Failed to connect wallet:', err)
          throw err
        }
      },

      async disconnect() {
        if (!this.adapter) throw new Error('Wallet not initialized')
        try {
          await this.adapter.disconnect()
        } catch (err: any) {
          console.error('Failed to disconnect wallet:', err)
          throw err
        }
      },

      async sendTransaction(transaction: any, connection: Connection): Promise<string> {
        if (!this.adapter) throw new Error('Wallet not initialized')
        if (!this.adapter.connected) {
          throw new WalletNotConnectedError()
        }

        try {
          const signature = await this.adapter.sendTransaction(transaction, connection)
          return signature
        } catch (err: any) {
          console.error('Failed to send transaction:', err)
          throw err
        }
      },

      async signTransaction(transaction: any): Promise<any> {
        if (!this.adapter) throw new Error('Wallet not initialized')
        if (!this.adapter.connected) {
          throw new WalletNotConnectedError()
        }

        try {
          const signed = await this.adapter.signTransaction(transaction)
          return signed
        } catch (err: any) {
          console.error('Failed to sign transaction:', err)
          throw err
        }
      },

      async signMessage(message: Uint8Array): Promise<Uint8Array> {
        if (!this.adapter) throw new Error('Wallet not initialized')
        if (!this.adapter.connected) {
          throw new WalletNotConnectedError()
        }

        try {
          // signMessage might not exist on all adapters
          if (!this.adapter.signMessage) {
            throw new Error('Wallet does not support message signing')
          }
          const signature = await this.adapter.signMessage(message)
          return signature
        } catch (err: any) {
          console.error('Failed to sign message:', err)
          throw err
        }
      }
    }
  }

  /**
   * Subscribe to wallet connection changes
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners() {
    const connected = this.adapter?.connected ?? false
    for (const listener of this.listeners) {
      listener(connected)
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager()

/**
 * Get wallet from global manager
 */
export function getWallet(): UnifiedWallet {
  return walletManager.getWallet()
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected(): boolean {
  const wallet = walletManager.getWallet()
  return wallet.connected && !!wallet.publicKey
}
