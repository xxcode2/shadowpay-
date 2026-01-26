import { PrivacyCash } from 'privacycash'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * ✅ REAL DEPOSIT EXECUTION SESUAI DOKUMENTASI PRIVACY CASH
 * 
 * Frontend HARUS menjalankan PrivacyCash SDK untuk deposit
 * User akan melihat popup Phantom: "Approve transaction: 0.01 SOL to Privacy Cash pool"
 * Dana MASUK LANGSUNG ke smart contract, bukan ke operator wallet
 */
export async function executeRealDeposit({
  lamports,
  wallet,
}: {
  lamports: number
  wallet: any // Wallet adapter dari Phantom
}): Promise<{ tx: string }> {
  try {
    const amountSOL = (lamports / LAMPORTS_PER_SOL).toFixed(6)
    console.log(`🚀 Executing REAL deposit of ${amountSOL} SOL from USER WALLET`)
    console.log('   ⭐ Phantom popup will show: "Approve transaction to Privacy Cash pool"')

    // ✅ INITIALIZE PrivacyCash SDK di FRONTEND
    const pc = new PrivacyCash({
      RPC_url: import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com',
      owner: wallet, // USER WALLET - bukan operator!
      enableDebug: import.meta.env.DEV,
    } as any)

    // ✅ USER LANGSUNG BAYAR KE SMART CONTRACT (TRIGGERS PHANTOM POPUP!)
    console.log('⏳ Waiting for your approval in Phantom wallet...')
    const { tx } = await pc.deposit({ lamports })

    console.log(`✅ Deposit successful! Transaction: ${tx}`)
    console.log(`   ${amountSOL} SOL was transferred DIRECTLY to Privacy Cash pool`)
    return { tx }
  } catch (err: any) {
    console.error('❌ PrivacyCash deposit failed:', err)
    
    if (err.message?.toLowerCase().includes('user rejected')) {
      throw new Error('❌ Payment cancelled. Please approve the Phantom popup to continue.')
    }
    
    throw new Error(`❌ Deposit failed: ${err.message || 'Unknown error'}`)
  }
}
