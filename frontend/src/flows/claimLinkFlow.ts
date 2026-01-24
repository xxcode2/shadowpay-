import { PublicKey } from '@solana/web3.js'

export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

// Uint8Array → hex
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function executeClaimLink(input: {
  linkId: string
  wallet: SigningWallet
}) {
  const { linkId, wallet } = input

  console.log('🔐 Signing authorization message...')
  const message = new TextEncoder().encode('Privacy Money account sign in')
  const signature = await wallet.signMessage(message)

  const payload = {
    linkId,
    recipientAddress: wallet.publicKey.toString(),
    signature: toHex(signature),
  }

  console.log('📡 Sending claim request:', payload)

  const res = await fetch(`${BACKEND_URL}/api/claim-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claim failed: ${err}`)
  }

  const data = await res.json()
  console.log('✅ Claim successful:', data.withdrawTx)

  return data
}
