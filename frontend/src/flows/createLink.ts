/**
 * ✅ IMPLEMENTASI YANG BENAR SESUAI DOKUMENTASI RESMI PRIVACY CASH SDK
 * 
 * FLOW:
 * 1. Buat metadata link di backend
 * 2. User LANGSUNG eksekusi deposit ke Privacy Cash pool (frontend)
 * 3. SDK menghandle encryption dan privacy
 * 4. Backend hanya record transaction hash
 * 
 * Benefits:
 * ✅ User deposit langsung ke Privacy Cash pool (bukan melalui backend)
 * ✅ Encryption handled by SDK client-side
 * ✅ Backend hanya record, tidak eksekusi
 * ✅ No need for backend RPC key
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { executeRealDeposit } from './depositFlow'

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
    // 1️⃣ CREATE LINK METADATA ON BACKEND
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

    // 2️⃣ USER LANGSUNG DEPOSIT KE PRIVACY CASH POOL (SESUAI DOKUMENTASI RESMI)
    console.log(`💰 Processing payment...`)
    console.log(`   📋 Step 1: User akan sign offchain message untuk encryption`)
    console.log(`   📤 Step 2: SDK akan execute deposit ke Privacy Cash pool`)
    console.log(`   ✅ Step 3: Backend akan record transaction hash`)

    const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)

    // ✅ SESUAI DOKUMENTASI RESMI - SDK SUPPORT BROWSER USAGE!
    const { tx: depositTx } = await executeRealDeposit({
      lamports,
      wallet: wallet as any,
      linkId,
    })

    console.log(`✅ User paid ${amountSOL} SOL directly to Privacy Cash pool`)
    console.log(`✅ Link ready! Transaction: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK ERROR:', err.message || err.toString())
    throw err
  }
}

