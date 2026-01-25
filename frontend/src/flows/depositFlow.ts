import { PublicKey } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'

export interface SigningWallet {
  publicKey: PublicKey
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

  console.log(`🚀 Executing REAL PrivacyCash deposit: ${(lamports / 1e9).toFixed(4)} SOL`)

  try {
    // Create PrivacyCash instance with USER wallet as owner
    const pc = new PrivacyCash({
      owner: wallet,
    } as any)

    // Execute REAL deposit transaction
    const { tx } = await pc.deposit({
      lamports,
    })

    console.log('✅ Deposit tx hash:', tx)
    return tx
  } catch (err: any) {
    console.error('❌ PrivacyCash deposit failed:', err.message)
    throw new Error(`PrivacyCash deposit failed: ${err.message}`)
  }
}
