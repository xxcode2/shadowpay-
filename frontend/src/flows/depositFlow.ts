import { PublicKey } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'
import { PrivacyCashService } from '../services/privacyCashService.js'

export interface SigningWallet {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
  signTransaction(tx: any): Promise<any>
  signAllTransactions(txs: any[]): Promise<any[]>
}

/**
 * 🔥 REAL PrivacyCash deposit execution
 * Runs on FRONTEND with USER wallet (Phantom)
 * 
 * NO backend PrivacyCash involved
 * NO operator wallet used
 * PURE user-initiated transaction
 */
export async function executeDeposit({
  lamports,
  wallet,
}: {
  lamports: number
  wallet: SigningWallet
}): Promise<string> {
  if (!wallet?.publicKey) {
    throw new Error('Wallet not connected')
  }

  if (import.meta.env.DEV) console.log(`🚀 Executing REAL PrivacyCash deposit: ${(lamports / 1e9).toFixed(4)} SOL`)

  try {
    // ✅ CRITICAL: Derive encryption key BEFORE deposit
    // Privacy Cash SDK requires this for deposit transaction
    if (!PrivacyCashService.isReady()) {
      if (import.meta.env.DEV) console.log('🔐 Deriving encryption key first...')
      await PrivacyCashService.deriveEncryptionKey(wallet)
    }

    const RPC = import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com'

    if (import.meta.env.DEV) console.log(`📡 Using RPC: ${RPC}`)
    if (import.meta.env.DEV) console.log(`👤 Wallet: ${wallet.publicKey.toString()}`)

    // Create PrivacyCash instance with USER wallet as owner
    const pc = new PrivacyCash({
      RPC_url: RPC,
      owner: wallet,
      enableDebug: import.meta.env.DEV,
    } as any)

    if (import.meta.env.DEV) console.log(`⏳ Waiting for Privacy Cash deposit...`)

    // Execute REAL deposit transaction
    const { tx } = await pc.deposit({
      lamports,
    })

    if (import.meta.env.DEV) console.log('✅ Deposit tx hash:', tx)
    return tx
  } catch (err: any) {
    console.error('❌ PrivacyCash deposit failed:', err)
    throw new Error(`PrivacyCash deposit failed: ${err.message || err.toString()}`)
  }
}
