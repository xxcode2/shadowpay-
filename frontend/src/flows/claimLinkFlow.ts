import { PublicKey } from '@solana/web3.js'

export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

/**
 * Convert Uint8Array to hex string (browser-safe)
 */
function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * ✅ FRONTEND ONLY: Sign message + notify backend
 * Backend will handle PrivacyCash withdraw
 */
export async function executeClaimLink(input: {
  linkId: string
  wallet: SigningWallet
}) {
  const { linkId, wallet } = input

  console.log('🔐 Signing message for withdrawal...')
  const msg = new TextEncoder().encode('Privacy Money account sign in')
  const signature = await wallet.signMessage(msg)
  const signatureHex = toHexString(signature)

  console.log('📡 Sending to backend for withdrawal...')
  const res = await fetch(`${BACKEND_URL}/api/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      recipientAddress: wallet.publicKey.toString(),
      signature: signatureHex,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Withdrawal failed: ${error}`)
  }

  const data = await res.json()
  console.log('✅ Withdrawal executed:', data.withdrawTx)

  return {
    success: true,
    withdrawTx: data.withdrawTx,
  }
}
