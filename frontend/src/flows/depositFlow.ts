import { PrivacyCash } from 'privacycash'
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import nacl from 'tweetnacl'

/**
 * ✅ SOLUSI AKHIR SESUAI LOG ASLI PRIVACY CASH
 * 
 * Dari log asli:
 * "start signMsg"
 * "got kp HVTcapLWRVzbjd8JZJd349ghHjJJvrSK8o8NcCJbnAr4"
 * 
 * Ini berarti:
 * 1. User sign pesan tetap: "Privacy Money account sign in"
 * 2. Dari signature, generate encryption key
 * 3. Encryption key digunakan sebagai seed untuk Keypair owner
 * 4. Owner keypair + wallet adapter = parameter inisialisasi SDK
 */
export async function executeRealDeposit({
  lamports,
  wallet,
}: {
  lamports: number
  wallet: any
}): Promise<{ tx: string }> {
  try {
    const amountSOL = (lamports / LAMPORTS_PER_SOL).toFixed(6)
    console.log(`🚀 Executing REAL deposit of ${amountSOL} SOL from USER WALLET`)

    // ✅ LANGKAH 1: SIGN PESAN TETAP UNTUK ENKRIPSI (SESUAI LOG ASLI)
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const message = new TextEncoder().encode(SIGN_MESSAGE)
    console.log('🔐 Signing fixed message for encryption key...')
    
    const signature = await wallet.signMessage(message)
    console.log('✅ Fixed message signed successfully')

    // ✅ LANGKAH 2: GENERATE ENCRYPTION KEY DARI SIGNATURE
    console.log('🔑 Generating encryption key from signature...')
    const encryptionKey = generateEncryptionKey(signature)
    
    // ✅ LANGKAH 3: BUAT KEYPAIR OWNER DARI ENCRYPTION KEY
    console.log('🧩 Creating owner keypair from encryption key...')
    const seed = encryptionKey.slice(0, 32)
    const owner = Keypair.fromSeed(seed)
    console.log(`✅ Owner keypair created: ${owner.publicKey.toString().slice(0, 8)}...`)

    // ✅ LANGKAH 4: INISIALISASI SDK DENGAN PARAMETER YANG BENAR
    const pc = new PrivacyCash({
      RPC_url: import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com',
      owner: owner, // ✅ KEYPAIR DARI SIGNATURE USER
      wallet: {
        adapter: wallet, // ✅ WALLET ADAPTER UNTUK SIGNING TRANSAKSI
        publicKey: wallet.publicKey
      },
      apiEndpoint: 'https://api3.privacycash.org', // ✅ SESUAI LOG
      enableDebug: import.meta.env.DEV,
    } as any)

    // ✅ EKSEKUSI DEPOSIT
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
    
    if (err.message?.includes('param "owner" is not a valid Private Key')) {
      throw new Error(
        'Critical SDK error. Please refresh the page and try again. ' +
        'If the problem persists, contact support with error code: OWNER_INVALID'
      )
    }
    
    throw new Error(`❌ Deposit failed: ${err.message || 'Unknown error'}`)
  }
}

/**
 * ✅ HELPER FUNCTION: GENERATE ENCRYPTION KEY
 * 
 * Sesuai log asli PrivacyCash, mereka generate encryption key dari signature.
 * Ini adalah implementasi yang sesuai dengan cara kerja asli mereka.
 */
function generateEncryptionKey(signature: Uint8Array): Uint8Array {
  const seed = signature.slice(0, 32)
  const hash = nacl.hash(seed)
  return new Uint8Array(hash.slice(0, 32))
}
