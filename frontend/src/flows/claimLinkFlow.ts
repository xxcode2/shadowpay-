import { PublicKey } from '@solana/web3.js'

export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function executeClaimLink(input: {
  linkId: string
  wallet: SigningWallet
}) {
  const { linkId, wallet } = input

  const message = new TextEncoder().encode(
    `ShadowPay claim authorization for ${linkId}`
  )

  const signed = await wallet.signMessage(message)
  const signatureHex = toHex(signed.signature)

  const payload = {
    linkId,
    recipientAddress: wallet.publicKey.toString(),
    signature: signatureHex,
  }

  const res = await fetch(`${BACKEND_URL}/api/claim-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return res.json()
}
