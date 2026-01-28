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
  private static isSignatureDerived: boolean = false

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
      // Get the derived UTXO private key from encryption service
      const utxoPrivateKey = this.encryptionService.deriveUtxoPrivateKey()
      
      if (!utxoPrivateKey) {
        throw new Error('Failed to derive UTXO private key')
      }
      
      // Use Privacy Cash SDK to derive the proper public key from the private key
      // The public key should be the PoseidonHash of the private key (handled by SDK)
      // If the SDK provides a method to get the pubkey, use it:
      let pubkey: string
      
      try {
        // Attempt to use SDK's key derivation if available
        // @ts-ignore - SDK method may not be typed
        if (this.encryptionService.deriveUtxoPublicKey) {
          pubkey = this.encryptionService.deriveUtxoPublicKey()
        } else if (this.encryptionService.getPoseidonHash) {
          // @ts-ignore
          pubkey = this.encryptionService.getPoseidonHash(utxoPrivateKey)
        } else {
          // Fallback: Use the private key hex representation
          // NOTE: This is NOT the proper public key - real Privacy Cash SDK handles this
          throw new Error(
            'Privacy Cash SDK method for deriving UTXO public key not available. ' +
            'Please ensure you are using the correct version of the Privacy Cash SDK with pubkey derivation.'
          )
        }
      } catch (sdkErr: any) {
        // If SDK methods are not available, throw an error instead of using fake data
        throw new Error(
          `Cannot derive proper UTXO public key: ${sdkErr.message}. ` +
          `This is required for Privacy Cash integration. ` +
          `Please check that the Privacy Cash SDK is properly initialized.`
        )
      }
      
      return {
        privateKey: utxoPrivateKey,
        pubkey: {
          toString: () => pubkey
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
