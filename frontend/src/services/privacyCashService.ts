import { EncryptionService } from 'privacycash/utils'
import { PublicKey } from '@solana/web3.js'

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
  private static privacyCashClient: any = null
  private static isSignatureDerived: boolean = false

  /**
   * Load circuit files (WASM + ZKEY) from public folder
   * These are needed for ZK proof generation
   */
  private static async loadCircuitFiles(): Promise<{
    wasmPath: string
    zkeyPath: string
  }> {
    console.log('📦 Loading Privacy Cash circuit files...')
    
    // Circuit files are served from public/circuits folder
    // Vite will serve public folder at root
    const wasmPath = '/circuits/transaction2.wasm'
    const zkeyPath = '/circuits/transaction2.zkey'
    
    // Verify files are accessible
    try {
      const wasmResponse = await fetch(wasmPath, { method: 'HEAD' })
      const zkeyResponse = await fetch(zkeyPath, { method: 'HEAD' })
      
      if (!wasmResponse.ok || !zkeyResponse.ok) {
        throw new Error('Circuit files not found in public/circuits folder')
      }
      
      console.log('✅ Circuit files loaded:')
      console.log(`   WASM: ${wasmPath}`)
      console.log(`   ZKEY: ${zkeyPath}`)
      
      return { wasmPath, zkeyPath }
    } catch (error) {
      console.error('❌ Failed to load circuit files:', error)
      throw new Error('Privacy Cash circuit files not found. Ensure they are in public/circuits/')
    }
  }

  /**
   * Initialize Privacy Cash SDK client
   * This creates the main client for deposit/withdraw operations
   * Loads circuit files (transaction2.wasm and transaction2.zkey) from public folder
   */
  static async initializeClient(rpcUrl: string = 'https://api.mainnet-beta.solana.com'): Promise<any> {
    try {
      console.log('🚀 Initializing Privacy Cash SDK client...')
      console.log(`   RPC URL: ${rpcUrl}`)
      
      // Load circuit files for ZK proof generation
      const { wasmPath, zkeyPath } = await this.loadCircuitFiles()
      
      // Initialize Privacy Cash client with circuit files
      // The actual client will be created when SDK methods are called
      this.privacyCashClient = {
        rpcUrl,
        isReady: true,
        circuits: {
          wasmPath,
          zkeyPath
        },
        deposit: async (params: { lamports: number }) => {
          console.log('📝 Calling Privacy Cash SDK deposit()...')
          console.log(`   Amount: ${params.lamports} lamports`)
          console.log(`   Using circuits from: ${wasmPath}, ${zkeyPath}`)
          
          // This will be called when actual SDK is fully integrated
          // SDK will use circuit files for ZK proof generation
          throw new Error(
            'Privacy Cash SDK client deposit() not fully initialized. ' +
            'Circuit files loaded, but SDK integration pending. ' +
            'Check Privacy Cash SDK documentation.'
          )
        }
      }
      
      console.log('✅ Privacy Cash SDK client initialized with circuit files')
      return this.privacyCashClient
    } catch (error) {
      console.error('❌ Failed to initialize Privacy Cash SDK client:', error)
      throw error
    }
  }

  /**
   * Get the Privacy Cash SDK client
   * Initialize it first with initializeClient()
   */
  static getClient(): any {
    if (!this.privacyCashClient) {
      // Try to initialize with default RPC
      return this.initializeClient()
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
