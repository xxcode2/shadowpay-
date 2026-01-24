import { PublicKey } from '@solana/web3.js'

export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

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

  console.log('🔐 Signing message for encryption...')
  const msg = new TextEncoder().encode('Privacy Money account sign in')
  const signature = await wallet.signMessage(msg)
  const signatureHex = Buffer.from(signature).toString('hex')

  console.log('📡 Sending to backend for deposit...')
  const res = await fetch(`${BACKEND_URL}/api/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      lamports,
      senderPubkey: wallet.publicKey.toString(),
      signature: signatureHex,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Deposit failed: ${error}`)
  }

  const data = await res.json()
  console.log('✅ Deposit recorded:', data.depositTx)

  return {
    success: true,
    depositTx: data.depositTx,
  }
}
