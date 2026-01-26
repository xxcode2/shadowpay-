/**
 * ✅ CORRECT ARCHITECTURE SESUAI PRIVACY CASH DOCUMENTATION:
 * 1. Create link metadata on backend
 * 2. User signs authorization message (NO PrivacyCash SDK on frontend!)
 * 3. Backend executes REAL deposit dengan PrivacyCash SDK + operator private key
 * 4. Link ready to claim
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export interface SigningWallet {
  publicKey: { toString(): string }
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

export async function createLink({
  amountSOL,
  wallet,
}: {
  amountSOL: number
  wallet: SigningWallet
}): Promise<{ linkId: string; depositTx: string }> {
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  try {
    // 1️⃣ Create link metadata on backend
    console.log(`📝 Creating payment link for ${amountSOL} SOL...`)
    const createRes = await fetch(`${BACKEND_URL}/api/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountSOL,
        assetType: 'SOL',
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Create link failed: ${createRes.statusText}`)
    }

    const { linkId } = await createRes.json()
    console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ User signs authorization message (HANYA SIGN, TIDAK ADA EXECUTION!)
    console.log(`🔐 Signing authorization message for ${amountSOL} SOL deposit...`)
    const message = new TextEncoder().encode(
      `Authorize deposit of ${amountSOL} SOL to Privacy Cash pool for link ${linkId}`
    )
    
    let signature: Uint8Array
    try {
      signature = await wallet.signMessage(message)
    } catch (signErr: any) {
      console.error('❌ USER REJECTED SIGNATURE')
      throw new Error('Signature cancelled by user. Please approve the popup.')
    }

    console.log(`✅ Authorization signed successfully`)

    // 3️⃣ Send to backend for REAL deposit execution (PrivacyCash SDK di backend)
    console.log(`📤 Sending authorization to backend for deposit execution...`)
    const depositRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        linkId,
        signature: Array.from(signature), // Convert Uint8Array to array
        publicKey: wallet.publicKey.toString(),
        amount: amountSOL,
      }),
    })

    if (!depositRes.ok) {
      const errorText = await depositRes.text()
      throw new Error(`Deposit failed: ${errorText || depositRes.statusText}`)
    }

    const { depositTx } = await depositRes.json()
    console.log(`✅ Deposit executed successfully: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK ERROR:', err.message || err.toString())
    throw err
  }
}

