import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'
import { CONFIG } from '../config'

/**
 * ✅ IMPLEMENTASI PRIVACY CASH SDK SESUAI DOKUMENTASI RESMI
 * 
 * SDK menghandle:
 * ✅ User signature request untuk derivasi encryption key
 * ✅ Encryption dan privacy-preserving protocol
 * ✅ Direct deposit ke Privacy Cash shielded pool
 * 
 * Dokumentasi: https://privacycash.mintlify.app/sdk/overview-copied-1
 */

export async function executeRealDeposit({
  lamports,
  wallet,
  linkId,
}: {
  lamports: number
  wallet: any
  linkId: string
}): Promise<{ tx: string }> {
  try {
    const amountSOL = (lamports / LAMPORTS_PER_SOL).toFixed(6)
    console.log(`🚀 Executing REAL deposit of ${amountSOL} SOL to Privacy Cash pool`)
    console.log(`   📋 User akan sign offchain message untuk encryption key`)
    console.log(`   ⭐ Phantom popup: "Sign message: Privacy Money account sign in"`)

    // ✅ INITIALIZE PRIVACYCASH SDK
    // SDK akan handle:
    // 1. Request user signature untuk encrypt data
    // 2. Derive encryption key dari signature
    // 3. Create shielded transaction
    // 4. Submit to Privacy Cash pool
    console.log('🚀 Initializing Privacy Cash SDK...')
    const RPC_URL = CONFIG.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com'

    const pc = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: wallet, // Wallet adapter atau Keypair
      enableDebug: import.meta.env.DEV,
    } as any)

    console.log('✅ Privacy Cash SDK initialized')

    // ✅ EXECUTE DEPOSIT
    // SDK akan:
    // 1. Ask user to sign: "Privacy Money account sign in"
    // 2. Derive encryption key dari signature
    // 3. Create shielded deposit transaction
    // 4. Submit to blockchain
    console.log(`⏳ Executing deposit (${amountSOL} SOL)...`)
    console.log(`   💬 Check Phantom popup for signature request`)

    const { tx } = await pc.deposit({ lamports })

    console.log(`✅ Deposit successful! Transaction: ${tx}`)
    console.log(`   ${amountSOL} SOL transferred to Privacy Cash shielded pool`)

    // ✅ RECORD DEPOSIT DI BACKEND (HANYA RECORD, BUKAN EKSEKUSI)
    console.log(`📤 Notifying backend about deposit...`)
    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL ||
      'https://shadowpay-backend-production.up.railway.app'

    const recordRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        depositTx: tx,
        amount: amountSOL,
        publicKey: wallet.publicKey?.toString() || wallet.toString(),
      }),
    })

    if (!recordRes.ok) {
      const errorData = await recordRes.json()
      throw new Error(`Backend recording error: ${errorData.error || recordRes.statusText}`)
    }

    console.log(`✅ Backend notified successfully`)
    return { tx }
  } catch (err: any) {
    console.error('❌ PrivacyCash deposit failed:', err)

    // ✅ USER-FRIENDLY ERROR MESSAGES
    if (err.message?.toLowerCase().includes('user rejected')) {
      throw new Error('❌ Signature cancelled. Please approve the Phantom popup to continue.')
    }

    if (err.message?.toLowerCase().includes('insufficient')) {
      throw new Error('❌ Insufficient balance. Please check your wallet balance.')
    }

    throw new Error(`❌ Deposit failed: ${err.message || 'Unknown error'}`)
  }
}
