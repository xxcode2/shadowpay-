import { PrivacyCash } from 'privacycash'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * ✅ REAL DEPOSIT EXECUTION SESUAI LOG ASLI PRIVACY CASH
 * 
 * Inisialisasi PrivacyCash SDK dengan format YANG BENAR:
 * - wallet: { adapter, publicKey } ✅ (BUKAN owner: Keypair ❌)
 * - apiEndpoint: 'https://api3.privacycash.org' ✅ (sesuai log)
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

    // ✅ INITIALIZE PrivacyCash SDK DI FRONTEND - SESUAI LOG ASLI
    // Parameter YANG BENAR berdasarkan log asli PrivacyCash:
    // - wallet: { adapter, publicKey } (BUKAN owner: Keypair)
    // - apiEndpoint: 'https://api3.privacycash.org'
    const pc = new PrivacyCash({
      RPC_url: import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com',
      wallet: {
        adapter: wallet,           // ✅ PHANTOM WALLET ADAPTER LANGSUNG
        publicKey: wallet.publicKey // ✅ PUBLIC KEY DARI WALLET
      },
      apiEndpoint: 'https://api3.privacycash.org', // ✅ SESUAI LOG: api3.privacycash.org
      enableDebug: import.meta.env.DEV,
    } as any) // Type casting untuk kompatibilitas

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
    
    // ✅ HANDLE ERROR KHUSUS: "param 'owner' is not a valid Private Key"
    if (err.message?.includes('param "owner" is not a valid Private Key') || 
        err.message?.includes('not a valid')) {
      console.error('⚠️  SDK initialization error detected')
      console.error('   This usually means SDK expects different parameter format')
      console.error('   Ensure wallet parameter is { adapter, publicKey } format')
      throw new Error(
        'PrivacyCash SDK configuration error. Please ensure wallet adapter is correctly connected.'
      )
    }
    
    throw new Error(`❌ Deposit failed: ${err.message || 'Unknown error'}`)
  }
}
