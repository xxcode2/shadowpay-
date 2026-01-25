import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'

/**
 * ✅ REAL DEPOSIT EXECUTION - User pays directly from their wallet
 *
 * CRITICAL: PrivacyCash SDK MUST run on frontend for deposit execution
 * This will trigger Phantom popup for payment approval (THIS IS WHAT WAS MISSING!)
 *
 * User flow:
 * 1. User creates link for 0.01 SOL
 * 2. Frontend calls executeRealDeposit()
 * 3. User sees Phantom popup: "Approve payment: 0.01 SOL"
 * 4. User clicks Approve in Phantom
 * 5. Deposit succeeds, user gets link
 */
export async function executeRealDeposit({
  lamports,
  wallet,
}: {
  lamports: number
  wallet: any // Wallet adapter from Phantom
}): Promise<{ tx: string }> {
  try {
    const amountSOL = (lamports / LAMPORTS_PER_SOL).toFixed(6)
    console.log(`🚀 Executing REAL deposit of ${amountSOL} SOL from USER WALLET`)
    console.log('   ⭐ Phantom popup should appear for payment approval!')

    // ✅ INITIALIZE PrivacyCash with USER WALLET as owner
    // This is critical - user's wallet will be charged
    const pc = new PrivacyCash({
      RPC_url: import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com',
      owner: wallet, // USER WALLET - they will pay!
      enableDebug: import.meta.env.DEV,
    } as any)

    // ✅ USER DIRECTLY PAYS FROM WALLET
    // ⭐ THIS TRIGGERS PHANTOM POPUP FOR PAYMENT APPROVAL ⭐
    console.log('⏳ Waiting for Phantom approval...')
    const { tx } = await pc.deposit({ lamports })

    console.log(`✅ Deposit successful! Transaction: ${tx}`)
    console.log(`   ${amountSOL} SOL was transferred from user wallet to Privacy Cash pool`)
    return { tx }
  } catch (err: any) {
    const errorMsg = err?.message || err?.toString() || 'Unknown error'
    console.error('❌ PrivacyCash deposit failed:', errorMsg)

    // ✅ DETECT USER REJECTION
    if (
      errorMsg.toLowerCase().includes('user rejected') ||
      errorMsg.toLowerCase().includes('user denied') ||
      errorMsg.toLowerCase().includes('cancelled')
    ) {
      throw new Error('❌ Payment cancelled. Please approve the Phantom popup to continue.')
    }

    throw new Error(`❌ Deposit failed: ${errorMsg}`)
  }
}
