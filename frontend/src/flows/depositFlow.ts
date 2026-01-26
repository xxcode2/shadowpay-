import { Connection, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CONFIG } from '../config'

/**
 * ✅ SOLUSI YANG BENAR - DEPOSIT LANGSUNG KE SMART CONTRACT
 * 
 * TANPA PrivacyCash SDK di frontend!
 * User melakukan transfer biasa ke Privacy Cash Pool address
 * Backend hanya record transaksi
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
    console.log(`🚀 Executing deposit of ${amountSOL} SOL to Privacy Cash pool`)

    // ✅ ALAMAT SMART CONTRACT PRIVACY CASH POOL
    const PRIVACY_CASH_POOL = CONFIG.PRIVACY_CASH_POOL

    // ✅ SETUP CONNECTION
    const connection = new Connection(
      CONFIG.SOLANA_RPC_URL,
      'confirmed'
    )

    // ✅ BUAT TRANSAKSI TRANSFER LANGSUNG
    console.log('📝 Creating transfer transaction to Privacy Cash pool...')
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(PRIVACY_CASH_POOL),
        lamports,
      })
    )

    // ✅ GET BLOCKHASH & SET RECENT
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet.publicKey

    // ✅ USER SIGN & SUBMIT TRANSAKSI
    console.log('🔐 Requesting signature from Phantom wallet...')
    const signedTx = await wallet.signTransaction(transaction)
    
    console.log('📤 Sending transaction to blockchain...')
    const txHash = await connection.sendRawTransaction(signedTx.serialize())
    
    // ✅ WAIT FOR CONFIRMATION
    console.log('⏳ Waiting for confirmation...')
    await connection.confirmTransaction(txHash, 'confirmed')

    console.log(`✅ Deposit successful! Transaction: ${txHash}`)
    console.log(`   ${amountSOL} SOL transferred directly to Privacy Cash pool`)
    return { tx: txHash }
  } catch (err: any) {
    console.error('❌ Deposit failed:', err)
    
    let errorMsg = err.message || 'Unknown error'
    
    if (errorMsg.toLowerCase().includes('user rejected')) {
      errorMsg = '❌ Payment cancelled. Please approve the Phantom popup to continue.'
    } else if (errorMsg.includes('invalid')) {
      errorMsg = 'Invalid transaction. Please check your wallet and try again.'
    }
    
    throw new Error(`❌ Deposit failed: ${errorMsg}`)
  }
}
