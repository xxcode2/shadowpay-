import { PrivacyCash } from 'privacycash'
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import nacl from 'tweetnacl'

/**
 * ✅ SOLUSI YANG BENAR UNTUK BERBAGAI FORMAT SIGNATURE
 * 
 * Phantom dan wallet lain mengembalikan signature dalam format berbeda:
 * - Phantom: { signature: Uint8Array } atau Uint8Array
 * - Backpack: { signature: Buffer }
 * - Solflare: ArrayBuffer atau Uint8Array
 * 
 * Fungsi ini menangani SEMUA format tersebut secara robust
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
    console.log('   ⭐ Phantom popup will show: "Approve transaction to Privacy Cash pool"')

    // ✅ LANGKAH 1: SIGN PESAN TETAP - HANDLE BERBAGAI RESPONSE FORMAT
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const message = new TextEncoder().encode(SIGN_MESSAGE)
    console.log('🔐 Signing fixed message for encryption key...')
    
    let rawSignature
    try {
      rawSignature = await wallet.signMessage(message)
      console.log('✅ Fixed message signed successfully')
      console.log('🔍 Raw signature type:', typeof rawSignature)
      
      if (rawSignature) {
        console.log('🔍 Raw signature structure:', {
          isArray: Array.isArray(rawSignature),
          isObject: typeof rawSignature === 'object',
          hasSignatureProp: rawSignature?.signature !== undefined,
          hasBufferProp: rawSignature?.buffer !== undefined,
          constructorName: rawSignature.constructor?.name,
        })
      }
    } catch (signErr) {
      console.error('❌ Failed to sign fixed message:', signErr)
      throw new Error('Failed to sign encryption message. Please retry.')
    }

    // ✅ LANGKAH 2: EKSTRAK SIGNATURE DALAM FORMAT Uint8Array
    const signature = extractUint8ArraySignature(rawSignature)
    console.log('✅ Signature extracted successfully. Length:', signature.length)
    console.log('🔍 First 8 bytes of signature:', Array.from(signature.slice(0, 8)))

    // ✅ LANGKAH 3: GENERATE ENCRYPTION KEY
    console.log('🔑 Generating encryption key from signature...')
    const encryptionKey = generateEncryptionKey(signature)
    console.log('✅ Encryption key generated. Length:', encryptionKey.length)

    // ✅ LANGKAH 4: BUAT KEYPAIR OWNER
    console.log('🧩 Creating owner keypair from encryption key...')
    const seed = encryptionKey.slice(0, 32)
    const owner = Keypair.fromSeed(seed)
    console.log(`✅ Owner keypair created: ${owner.publicKey.toString().slice(0, 8)}...`)

    // ✅ LANGKAH 5: INISIALISASI SDK DENGAN PARAMETER YANG BENAR
    const pc = new PrivacyCash({
      RPC_url: import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com',
      owner: owner, // ✅ KEYPAIR DARI SIGNATURE USER
      wallet: {
        adapter: wallet, // ✅ WALLET ADAPTER UNTUK SIGNING TRANSAKSI
        publicKey: wallet.publicKey,
      },
      apiEndpoint: 'https://api3.privacycash.org',
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
    
    let errorMsg = err.message || 'Unknown error'
    
    if (errorMsg.toLowerCase().includes('user rejected')) {
      errorMsg = '❌ Payment cancelled. Please approve the Phantom popup to continue.'
    } else if (errorMsg.includes('C.slice is not a function') || errorMsg.includes('slice is not a function')) {
      errorMsg = 'Signature format error. Please refresh the page and ensure you\'re using Phantom wallet.'
    } else if (errorMsg.includes('param "owner" is not a valid Private Key')) {
      errorMsg = 'Critical SDK error. Please refresh and try again.'
    }
    
    throw new Error(`❌ Deposit failed: ${errorMsg}`)
  }
}

/**
 * ✅ FUNGSI UTAMA: EKSTRAK SIGNATURE KE FORMAT Uint8Array
 * 
 * Handle semua format signature yang mungkin dari berbagai wallet:
 * - Phantom: { signature: Uint8Array } atau Uint8Array
 * - Array biasa: [232, 221, ...]
 * - ArrayBuffer/Buffer
 * - String hex
 */
function extractUint8ArraySignature(rawSignature: any): Uint8Array {
  console.log('🔄 Extracting Uint8Array from raw signature...')
  
  // ✅ Case 1: Langsung Uint8Array
  if (rawSignature instanceof Uint8Array) {
    console.log('✅ Signature is already Uint8Array')
    return rawSignature
  }
  
  // ✅ Case 2: Objek dengan property 'signature'
  if (rawSignature?.signature) {
    console.log('✅ Found signature in object.signature property')
    
    // Handle jika signature adalah Uint8Array
    if (rawSignature.signature instanceof Uint8Array) {
      return rawSignature.signature
    }
    
    // Handle jika signature adalah array biasa
    if (Array.isArray(rawSignature.signature)) {
      return Uint8Array.from(rawSignature.signature)
    }
    
    // Handle jika signature adalah ArrayBuffer/Buffer
    if (rawSignature.signature.buffer instanceof ArrayBuffer) {
      return new Uint8Array(rawSignature.signature.buffer)
    }
    
    console.warn('⚠️ Unsupported signature object format:', rawSignature)
    throw new Error('Unsupported signature format from wallet')
  }
  
  // ✅ Case 3: Array biasa [232, 221, ...]
  if (Array.isArray(rawSignature)) {
    console.log('✅ Signature is standard array')
    return Uint8Array.from(rawSignature)
  }
  
  // ✅ Case 4: ArrayBuffer atau Buffer
  if (rawSignature?.buffer instanceof ArrayBuffer) {
    console.log('✅ Signature is ArrayBuffer/Buffer')
    return new Uint8Array(rawSignature.buffer)
  }
  
  // ✅ Case 5: String (mungkin hex)
  if (typeof rawSignature === 'string') {
    console.log('✅ Signature is string - attempting hex conversion')
    // Hanya handle jika string hex dengan panjang genap
    if (/^[0-9a-fA-F]+$/.test(rawSignature) && rawSignature.length % 2 === 0) {
      const byteArray = new Uint8Array(rawSignature.length / 2)
      for (let i = 0; i < byteArray.length; i++) {
        byteArray[i] = parseInt(rawSignature.substr(i * 2, 2), 16)
      }
      return byteArray
    }
    throw new Error('Unsupported string signature format')
  }
  
  console.error('❌ Cannot handle signature format:', rawSignature)
  console.error('❌ Signature type:', typeof rawSignature)
  console.error('❌ Signature constructor:', rawSignature?.constructor?.name)
  
  throw new Error(
    'Unsupported signature format. Please use Phantom wallet and ensure it\'s updated to the latest version.'
  )
}

/**
 * ✅ GENERATE ENCRYPTION KEY DARI SIGNATURE
 * 
 * Versi robust yang handle berbagai format input
 */
function generateEncryptionKey(signature: Uint8Array): Uint8Array {
  console.log('🔐 Generating encryption key from signature...')
  console.log('🔍 Signature length:', signature.length)
  
  try {
    // Ambil 32 byte pertama dari signature
    const seed = signature.slice(0, 32)
    console.log('✅ Seed extracted from signature')
    
    // Hash seed untuk keamanan tambahan
    const hash = nacl.hash(seed)
    console.log('✅ Hash computed successfully')
    
    // Gunakan 32 byte pertama dari hash sebagai encryption key
    const encryptionKey = new Uint8Array(hash.slice(0, 32))
    console.log('✅ Encryption key created')
    
    return encryptionKey
  } catch (hashErr) {
    console.error('❌ Failed to generate encryption key:', hashErr)
    throw new Error('Failed to generate encryption key from signature')
  }
}
