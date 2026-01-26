import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CONFIG } from '../config'

/**
 * ✅ CORRECT ARCHITECTURE:
 * 1. Frontend: User signs authorization message (NOT transaction)
 * 2. Frontend: Sends authorization to backend
 * 3. Backend: Executes deposit with authenticated RPC (has API key in env)
 * 4. Backend: Records transaction
 * 
 * Why backend executes deposit:
 * - Frontend doesn't have RPC API key (security)
 * - Backend has authenticated RPC endpoint
 * - User's public key proves they authorized it
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

    // ✅ STEP 1: USER SIGNS AUTHORIZATION MESSAGE (proof of intent)
    console.log('🔐 Requesting authorization signature from Phantom wallet...')
    const authMessage = new TextEncoder().encode(
      `Authorize ${amountSOL} SOL deposit to Privacy Cash pool for link ${linkId}`
    )
    const signature = await wallet.signMessage(authMessage)

    // ✅ CONVERT SIGNATURE TO ARRAY (serializable)
    const signatureArray = Array.from(
      signature instanceof Uint8Array ? signature : new Uint8Array(signature)
    )

    console.log(`✅ User authorized deposit`)

    // ✅ STEP 2: SEND AUTHORIZATION TO BACKEND
    // Backend will verify signature and execute actual deposit transaction
    console.log('📤 Sending authorization to backend...')
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        amount: amountSOL,
        lamports,
        signature: signatureArray,
        publicKey: wallet.publicKey.toString(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Backend error: ${response.status}`)
    }

    const { tx: depositTx } = await response.json()

    console.log(`✅ Deposit successful! Transaction: ${depositTx}`)
    console.log(`   ${amountSOL} SOL transferred directly to Privacy Cash pool`)
    console.log(`   Backend executed with authenticated RPC`)
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
