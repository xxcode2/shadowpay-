import { Connection, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CONFIG } from '../config'

/**
 * ✅ CORRECT FLOW:
 * 1. Frontend: Create transfer transaction
 * 2. Frontend: User signs with Phantom (transaction signature)
 * 3. Frontend: Send SIGNED TRANSACTION to backend
 * 4. Backend: Submit the signed transaction
 * 
 * Why this works:
 * - User must sign the transfer (blockchain requirement)
 * - Frontend has direct RPC access (no API key needed for local ops)
 * - Backend submits the already-signed transaction
 * - User's signature proves authorization
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
    console.log(`🚀 Executing deposit of ${amountSOL} SOL to Privacy Cash pool`)

    // ✅ SETUP CONNECTION FOR FRONTEND
    const connection = new Connection(
      CONFIG.SOLANA_RPC_URL,
      'confirmed'
    )

    // ✅ PRIVACY CASH POOL ADDRESS
    const PRIVACY_CASH_POOL = CONFIG.PRIVACY_CASH_POOL

    // ✅ STEP 1: CREATE TRANSFER TRANSACTION
    console.log('📝 Creating transfer transaction to Privacy Cash pool...')
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(PRIVACY_CASH_POOL),
        lamports,
      })
    )

    // ✅ STEP 2: GET BLOCKHASH
    console.log('⏳ Getting latest blockhash...')
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet.publicKey

    // ✅ STEP 3: USER SIGNS TRANSACTION WITH PHANTOM
    console.log('🔐 Requesting signature from Phantom wallet...')
    console.log('   Phantom popup: "Approve transaction: Transfer SOL"')
    const signedTx = await wallet.signTransaction(transaction)

    // ✅ STEP 4: SERIALIZE FOR TRANSMISSION
    const serializedTx = signedTx.serialize()
    const txArray = Array.from(serializedTx)

    console.log(`✅ User signed transaction`)

    // ✅ STEP 5: SEND SIGNED TRANSACTION TO BACKEND
    console.log('📤 Sending signed transaction to backend...')
    const BACKEND_URL =
      import.meta.env.VITE_BACKEND_URL ||
      'https://shadowpay-backend-production.up.railway.app'

    const response = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        amount: amountSOL,
        lamports,
        signedTransaction: txArray, // ✅ SEND SIGNED TRANSACTION
        publicKey: wallet.publicKey.toString(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Backend error: ${response.status}`)
    }

    const { tx: depositTx } = await response.json()

    console.log(`✅ Deposit successful! Transaction: ${depositTx}`)
    console.log(`   ${amountSOL} SOL transferred to Privacy Cash pool`)
    return { tx: depositTx }
  } catch (err: any) {
    console.error('❌ Deposit failed:', err)

    let errorMsg = err.message || 'Unknown error'

    if (errorMsg.toLowerCase().includes('user rejected')) {
      errorMsg = '❌ Payment cancelled. Please approve the Phantom popup to continue.'
    } else if (errorMsg.includes('invalid')) {
      errorMsg = 'Invalid transaction. Please check your wallet and try again.'
    } else if (errorMsg.includes('access forbidden') || errorMsg.includes('403')) {
      errorMsg = 'RPC authentication error. Backend is not properly configured.'
    }

    throw new Error(`❌ Deposit failed: ${errorMsg}`)
  }
}
