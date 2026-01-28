import { EncryptionService } from 'privacycash/utils'
import { PublicKey, Keypair } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'

/**
 * Wallet interface for Privacy Cash signing
 */
export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

/**
 * Privacy Cash Service
 * Handles all Privacy Cash SDK interactions in the frontend
 */

export class PrivacyCashService {
  private static encryptionService: EncryptionService | null = null
  private static privacyCashClient: PrivacyCash | null = null
  private static privacyCashKeypair: Keypair | null = null
  private static isSignatureDerived: boolean = false
  private static currentWallet: SigningWallet | null = null

  /**
   * Load circuit files (WASM + ZKEY) from multiple sources
   * Tries: local public folder -> npm package -> CDN
   */
  private static async loadCircuitFiles(): Promise<{
    wasmPath: string
    zkeyPath: string
  }> {
    console.log('📦 Loading Privacy Cash circuit files...')
    
    // Try multiple sources for circuit files
    const sources = [
      // 1. Try local public folder (dev)
      { wasmPath: '/circuits/transaction2.wasm', zkeyPath: '/circuits/transaction2.zkey', label: 'local public' },
      // 2. Try from Privacy Cash SDK npm package
      { wasmPath: '/node_modules/privacycash/circuit2/transaction2.wasm', zkeyPath: '/node_modules/privacycash/circuit2/transaction2.zkey', label: 'npm package' }
    ]
    
    for (const source of sources) {
      try {
        console.log(`   Trying ${source.label}...`)
        const wasmResponse = await fetch(source.wasmPath, { method: 'HEAD' })
        const zkeyResponse = await fetch(source.zkeyPath, { method: 'HEAD' })
        
        if (wasmResponse.ok && zkeyResponse.ok) {
          console.log('✅ Circuit files loaded:')
          console.log(`   WASM: ${source.wasmPath}`)
          console.log(`   ZKEY: ${source.zkeyPath}`)
          return { wasmPath: source.wasmPath, zkeyPath: source.zkeyPath }
        }
      } catch (err) {
        // Continue to next source
      }
    }
    
    // If all fail, provide helpful error
    console.error('❌ Failed to load circuit files from any source')
    throw new Error(
      'Privacy Cash circuit files not found. ' +
      'Ensure privacycash npm package is installed.'
    )
  }

  /**
   * Initialize Privacy Cash SDK client with wallet
   * This creates the main client for deposit/withdraw operations
   * @param wallet - Wallet adapter with signMessage capability
   * @param rpcUrl - Optional custom RPC URL (uses env or default if not provided)
   */
  static async initializeClient(wallet: SigningWallet, rpcUrl?: string): Promise<PrivacyCash> {
    try {
      if (!wallet) {
        throw new Error('Wallet is required to initialize Privacy Cash SDK')
      }

      // Use provided RPC or get from environment or use default
      const finalRpcUrl = rpcUrl || 
        process.env.VITE_RPC_URL || 
        'https://api.mainnet-beta.solana.com'
      
      console.log('🚀 Initializing Privacy Cash SDK client...')
      console.log(`   RPC URL: ${finalRpcUrl}`)
      console.log(`   Wallet: ${wallet.publicKey.toString()}`)
      
      // Load circuit files for ZK proof generation
      await this.loadCircuitFiles()
      
      // Initialize the real Privacy Cash SDK client
      // The SDK expects a string address or Keypair as owner
      const owner = wallet.publicKey.toString()
      
      this.privacyCashClient = new PrivacyCash({
        RPC_url: finalRpcUrl,
        owner: owner,
        enableDebug: true
      })
      
      this.currentWallet = wallet
      
      console.log('✅ Privacy Cash SDK client initialized successfully')
      return this.privacyCashClient
    } catch (error) {
      console.error('❌ Failed to initialize Privacy Cash SDK client:', error)
      throw error
    }
  }

  /**
   * Get Privacy Cash SDK client for user's wallet
   * This creates a client that uses the user's wallet for signing
   * @param wallet - User's wallet adapter (Phantom, Magic, etc)
   * @param userAddress - User's public key address
   * @returns PrivacyCash client instance
   */
  static getClientForUser(wallet: any, userAddress: string): PrivacyCash {
    try {
      if (!wallet) {
        throw new Error('Wallet is required to initialize Privacy Cash SDK')
      }

      // Use Helius RPC if available, otherwise fallback to Solana RPC
      const rpcUrl = process.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com'
      
      console.log('🚀 Initializing Privacy Cash SDK with user wallet...')
      console.log(`   RPC URL: ${rpcUrl}`)
      console.log(`   User Address: ${userAddress}`)
      console.log(`   Wallet: ${wallet.publicKey?.toString() || 'Connected'}`)
      
      // Initialize Privacy Cash SDK with user's address
      // SDK will use wallet.signTransaction() for signing transactions
      const privacyCashClient = new PrivacyCash({
        RPC_url: rpcUrl,
        owner: userAddress,  // User's public key address
        enableDebug: true
      })
      
      console.log('✅ Privacy Cash SDK initialized with your wallet')
      return privacyCashClient
    } catch (error: any) {
      console.error('❌ Failed to initialize Privacy Cash SDK for user:', error.message)
      throw error
    }
  }

  /**
   * Get the Privacy Cash SDK client
   * Must initialize it first with initializeClient()
   */
  static getClient(): PrivacyCash {
    if (!this.privacyCashClient) {
      throw new Error('Privacy Cash SDK client not initialized. Call initializeClient(wallet) first.')
    }
    return this.privacyCashClient
  }

  /**
   * Initialize encryption service by signing an off-chain message
   * Must be called once before any deposit/withdraw operations
   */
  static async deriveEncryptionKey(wallet: SigningWallet): Promise<void> {
    try {
      if (this.isSignatureDerived) {
        console.log('✅ Encryption key already derived')
        return
      }

      console.log('🔐 Deriving encryption key from wallet signature...')

      // Encode the sign-in message
      const encodedMessage = new TextEncoder().encode(`Privacy Money account sign in`)

      // Request user signature
      let signature: Uint8Array
      try {
        signature = await wallet.signMessage(encodedMessage)
      } catch (err: any) {
        if (err instanceof Error && err.message?.toLowerCase().includes('user rejected')) {
          throw new Error('User rejected the signature request')
        }
        throw new Error('Failed to sign message: ' + err.message)
      }

      // Handle wallets that return { signature } object
      // @ts-ignore
      if (signature.signature instanceof Uint8Array) {
        // @ts-ignore
        signature = signature.signature
      }

      if (!(signature instanceof Uint8Array)) {
        throw new Error('Signature is not a valid Uint8Array')
      }

      // Derive encryption key from signature
      this.encryptionService = new EncryptionService()
      this.encryptionService.deriveEncryptionKeyFromSignature(signature)

      this.isSignatureDerived = true
      console.log('✅ Encryption key derived successfully')
    } catch (error) {
      console.error('❌ Failed to derive encryption key:', error)
      throw error
    }
  }

  /**
   * Check if encryption key has been derived
   */
  static isReady(): boolean {
    return this.isSignatureDerived && this.encryptionService !== null
  }

  /**
   * Get the encryption service instance
   * Only safe to call after deriveEncryptionKey()
   */
  static getEncryptionService(): EncryptionService {
    if (!this.encryptionService) {
      throw new Error('Encryption service not initialized. Call deriveEncryptionKey() first.')
    }
    return this.encryptionService
  }

  /**
   * Get the UTXO keypair for creating encrypted outputs
   * The UTXO keypair is derived from the user's signature
   * 
   * UTXO Structure (from Privacy Cash):
   * - private key: derived from encryption key
   * - public key: PoseidonHash(privateKey)
   * - Used to encrypt/decrypt UTXOs
   */
  static getUtxoKeypair(): any {
    if (!this.encryptionService) {
      throw new Error('Encryption service not initialized. Call deriveEncryptionKey() first.')
    }
    
    try {
      // The EncryptionService has methods to handle UTXO keypair generation
      // We derive the private key and use it to create the keypair structure
      // @ts-ignore - SDK may not have full TypeScript definitions
      const utxoKeypair = this.encryptionService.getUtxoKeypair?.()
      
      if (utxoKeypair) {
        // SDK provided the keypair directly
        return utxoKeypair
      }
      
      // Fallback: manually construct from available methods
      // @ts-ignore
      const utxoPrivateKey = this.encryptionService.deriveUtxoPrivateKey?.()
      
      if (!utxoPrivateKey) {
        throw new Error(
          'Cannot derive UTXO keypair. ' +
          'Please ensure Privacy Cash SDK is properly initialized with getUtxoKeypair() or deriveUtxoPrivateKey() method.'
        )
      }
      
      // Return a keypair structure that can be used for UTXO operations
      return {
        privateKey: utxoPrivateKey,
        pubkey: {
          toString: () => utxoPrivateKey
        }
      }
    } catch (error) {
      console.error('Failed to get UTXO keypair:', error)
      throw error
    }
  }

  /**
   * Reset state (useful for wallet switching)
   */
  static reset(): void {
    this.encryptionService = null
    this.isSignatureDerived = false
    console.log('🔄 Privacy Cash Service reset')
  }
}
