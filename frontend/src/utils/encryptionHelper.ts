/**
 * Frontend Encryption Utilities
 * 
 * Same as backend - encrypt/decrypt UTXO private keys
 * Uses browser's crypto API (Web Crypto API)
 */

const ALGORITHM = 'AES-GCM'
const SALT = 'shadowpay-v1-encryption'
const ITERATIONS = 100000

/**
 * Derive encryption key from link ID (same as backend)
 */
async function deriveKeyFromLinkId(linkId: string): Promise<CryptoKey> {
  const passwordBuffer = new TextEncoder().encode(linkId)
  const saltBuffer = new TextEncoder().encode(SALT)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt UTXO private key for storage
 */
export async function encryptUtxoPrivateKey(
  utxoPrivateKey: string,
  linkId: string
): Promise<{
  encryptedUtxoPrivateKey: string
  iv: string
}> {
  const key = await deriveKeyFromLinkId(linkId)
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()
  const data = encoder.encode(utxoPrivateKey)

  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data)

  // Combine encrypted data with IV for transmission
  const encryptedArray = new Uint8Array(encrypted)
  const combined = new Uint8Array(encryptedArray.length + iv.length)
  combined.set(iv)
  combined.set(encryptedArray, iv.length)

  // For transmission, we encode as base64 but keep IV separate
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray))
  const ivBase64 = btoa(String.fromCharCode(...iv))

  return {
    encryptedUtxoPrivateKey: encryptedBase64,
    iv: ivBase64
  }
}

/**
 * Decrypt UTXO private key
 */
export async function decryptUtxoPrivateKey(
  encryptedData: string,
  ivBase64: string,
  linkId: string
): Promise<string> {
  const key = await deriveKeyFromLinkId(linkId)
  const encryptedArray = Uint8Array.from(atob(encryptedData), c =>
    c.charCodeAt(0)
  )
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encryptedArray
  )

  return new TextDecoder().decode(decrypted)
}
