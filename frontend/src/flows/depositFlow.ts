/**
 * ⚠️ DEPRECATED: This file is no longer used!
 * 
 * OLD (BROKEN) ARCHITECTURE:
 * - Frontend menggunakan PrivacyCash SDK directly
 * - Frontend pass wallet object ke PrivacyCash constructor
 * - ERROR: "param 'owner' is not a valid Private Key or Keypair"
 * - Alasan: Wallet object dari Phantom bukan Keypair!
 * 
 * NEW (CORRECT) ARCHITECTURE:
 * - Frontend hanya sign message (gunakan wallet.signMessage())
 * - Backend execute PrivacyCash SDK dengan operator private key
 * - PrivacyCash SDK hanya dijalankan di backend dengan Keypair yang valid
 * 
 * File ini disimpan untuk referensi historis saja.
 * Jangan gunakan lagi!
 */

export async function executeRealDeposit() {
  throw new Error(
    'executeRealDeposit() is DEPRECATED and no longer supported.\n' +
    'The PrivacyCash SDK must ONLY run on backend with operator private key.\n' +
    'Frontend should only sign messages using wallet.signMessage()'
  )
}
