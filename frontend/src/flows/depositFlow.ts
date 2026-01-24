import { PrivacyCash } from 'privacycash'
import { EncryptionService } from 'privacycash/utils'
import { PublicKey } from '@solana/web3.js'

export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

export async function executeDeposit(input: {
  linkId: string
  lamports: number
  wallet: SigningWallet
}) {
  const { linkId, lamports, wallet } = input

  console.log('🔐 Deriving encryption key...')
  const msg = new TextEncoder().encode('Privacy Money account sign in')
  const sig = await wallet.signMessage(msg)

  const encryption = new EncryptionService()
  encryption.deriveEncryptionKeyFromSignature(sig)

  console.log('🚀 Initializing Privacy Cash client...')
  const client = new PrivacyCash({
    RPC_url: SOLANA_RPC,
    enableDebug: false,
  } as any)

  console.log('💸 Depositing...')
  const result = await client.deposit({ lamports })

  console.log('✅ Deposit tx:', result.tx)

  console.log('📡 Notifying backend...')
  const res = await fetch(`${BACKEND_URL}/api/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      depositTx: result.tx,
    }),
  })

  if (!res.ok) throw new Error('Failed to record deposit')

  return {
    success: true,
    depositTx: result.tx,
  }
}
