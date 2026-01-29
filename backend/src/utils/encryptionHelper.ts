/**
 * Encryption Utilities for UTXO Private Key Storage
 * 
 * Uses AES-256-GCM for secure encryption
 * Key derived from link ID using PBKDF2
 * 
 * ✅ Non-custodial: Backend only stores encrypted data
 * ✅ Deterministic: Same linkId always derives same password
 * ✅ Secure: 256-bit AES, 100k PBKDF2 iterations
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'shadowpay-v1-encryption' // App-specific salt

/**
 * Derive encryption key from link ID
 * Same linkId always produces same key (deterministic)
 */
export function deriveKeyFromLinkId(linkId: string): Buffer {
  const password = linkId
  const saltBuffer = Buffer.from(SALT, 'utf8')

  return crypto.pbkdf2Sync(password, saltBuffer, 100000, 32, 'sha256')
}

/**
 * Encrypt UTXO private key for storage
 * 
 * Returns: { encryptedData, iv, salt }
 * All encoded as base64 strings for database storage
 */
export function encryptUtxoPrivateKey(
  utxoPrivateKey: string,
  linkId: string
): {
  encryptedData: string
  iv: string
  salt: string
} {
  const key = deriveKeyFromLinkId(linkId)
  const iv = crypto.randomBytes(16) // 16 bytes for GCM
  const saltBuffer = Buffer.from(SALT, 'utf8')

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(utxoPrivateKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Combine encrypted data with auth tag
  const encryptedWithTag = encrypted + authTag.toString('hex')

  return {
    encryptedData: encryptedWithTag,
    iv: iv.toString('base64'),
    salt: saltBuffer.toString('base64'),
  }
}

/**
 * Decrypt UTXO private key from storage
 * 
 * Throws error if decryption fails (invalid key or tampered data)
 */
export function decryptUtxoPrivateKey(
  encryptedData: string,
  iv: string,
  linkId: string
): string {
  const key = deriveKeyFromLinkId(linkId)
  const ivBuffer = Buffer.from(iv, 'base64')

  // Extract auth tag from encrypted data (last 32 chars = 16 bytes as hex)
  const encryptedHex = encryptedData.substring(0, encryptedData.length - 32)
  const authTagHex = encryptedData.substring(encryptedData.length - 32)
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Verify encryption integrity
 * Returns true if data can be decrypted successfully
 */
export function verifyEncryption(
  encryptedData: string,
  iv: string,
  linkId: string
): boolean {
  try {
    decryptUtxoPrivateKey(encryptedData, iv, linkId)
    return true
  } catch (err) {
    console.error('Encryption verification failed:', err)
    return false
  }
}
