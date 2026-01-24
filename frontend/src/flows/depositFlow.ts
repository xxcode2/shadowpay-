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
 * Backend will handle PrivacyCash deposit
 */
export async function executeDeposit(input: {
  linkId: string
  lamports: number
  wallet: SigningWallet
}) {
  const { linkId, lamports, wallet } = input

  console.log('🔐 Signing message for authorization...')
  const msg = new TextEncoder().encode('Privacy Money account sign in')
  const signature = await wallet.signMessage(msg)

  console.log('📡 Sending to backend for deposit...')
  const res = await fetch(`${BACKEND_URL}/api/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      lamports,
      senderAddress: wallet.publicKey.toString(),
      signature: Array.from(signature),
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Deposit failed: ${error}`)
  }

  const data = await res.json()
  console.log('✅ Deposit executed:', data.depositTx)

  return {
    success: true,
    depositTx: data.depositTx,
  }
}
