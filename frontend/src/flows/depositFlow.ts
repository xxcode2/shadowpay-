import { PrivacyCash } from 'privacycash'
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import nacl from 'tweetnacl'

/**
 * ✅ BROWSER-COMPATIBLE PRIVACYCASH SDK CONFIGURATION
 * 
 * Solusi untuk error "Path must be a string. Received undefined":
 * - Gunakan konfigurasi khusus untuk browser environment
 * - Hindari semua filesystem operations
 * - Gunakan localStorage untuk caching (sesuai log asli PrivacyCash)
 * - Override filesystem paths dengan memory storage
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

    // ✅ LANGKAH 1: SIGN PESAN TETAP (masih sama)
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const message = new TextEncoder().encode(SIGN_MESSAGE)
    console.log('🔐 Signing fixed message for encryption key...')
    
    let rawSignature = await wallet.signMessage(message)
    console.log('✅ Fixed message signed successfully')

    // ✅ LANGKAH 2: EKSTRAK SIGNATURE (masih sama)
    const signature = extractUint8ArraySignature(rawSignature)
    console.log('✅ Signature extracted successfully. Length:', signature.length)

    // ✅ LANGKAH 3: GENERATE ENCRYPTION KEY (masih sama)
    const encryptionKey = generateEncryptionKey(signature)
    console.log('✅ Encryption key generated. Length:', encryptionKey.length)

    // ✅ LANGKAH 4: BUAT KEYPAIR OWNER (masih sama)
    const seed = encryptionKey.slice(0, 32)
    const owner = Keypair.fromSeed(seed)
    console.log(`✅ Owner keypair created: ${owner.publicKey.toString().slice(0, 8)}...`)

    // ✅ LANGKAH 5: INISIALISASI SDK DENGAN BROWSER-COMPATIBLE CONFIG
    console.log('⚙️ Initializing PrivacyCash SDK for browser environment...')
    
    // ✅ KONFIGURASI KHUSUS UNTUK BROWSER (INI KUNCI KE SUKSES!)
    const browserConfig = {
      // ✅ RPC config
      RPC_url: import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com',
      
      // ✅ OWNER config (dari signature user)
      owner: owner,
      
      // ✅ WALLET config (untuk signing transaksi)
      wallet: {
        adapter: wallet,
        publicKey: wallet.publicKey,
      },
      
      // ✅ API config (sesuai log asli)
      apiEndpoint: 'https://api3.privacycash.org',
      
      // ✅ BROWSER-SPECIFIC CONFIG (HINDARI FILESYSTEM)
      browserMode: true, // ✅ AKTIFKAN MODE BROWSER
      cacheProvider: 'localStorage', // ✅ GUNAKAN localStorage SESUAI LOG ASLI
      storagePrefix: 'privacycash_', // ✅ PREFIX UNTUK localStorage
      
      // ✅ DEBUG config
      enableDebug: import.meta.env.DEV,
      
      // ✅ PATH OVERRIDE (HINDARI ERROR PATH)
      dataPath: 'memory://', // ✅ GUNAKAN MEMORY STORAGE, BUKAN FILESYSTEM
      cachePath: 'memory://', // ✅ SEMUA CACHE DI MEMORI
      utxoCachePath: 'memory://', // ✅ TIDAK PERLU FILESYSTEM PATHS
    }

    const pc = new PrivacyCash(browserConfig as any) // Type casting untuk kompatibilitas

    // ✅ EKSEKUSI DEPOSIT DENGAN CONFIG YANG BENAR
    console.log('⏳ Waiting for your approval in Phantom wallet...')
    const depositOptions = {
      lamports,
      enableDebug: import.meta.env.DEV,
      // ✅ OPTIONS TAMBAHAN UNTUK BROWSER
      skipFilesystem: true, // ✅ HINDARI FILESYSTEM OPERATIONS
      useMemoryCache: true, // ✅ GUNAKAN MEMORY CACHE
    }

    const { tx } = await pc.deposit(depositOptions)

    console.log(`✅ Deposit successful! Transaction: ${tx}`)
    console.log(`   ${amountSOL} SOL was transferred DIRECTLY to Privacy Cash pool`)
    return { tx }
  } catch (err: any) {
    console.error('❌ PrivacyCash deposit failed:', err)
    
    let errorMsg = err.message || 'Unknown error'
    
    // ✅ SPECIFIC ERROR HANDLING UNTUK BROWSER ISSUES
    if (errorMsg.includes('Path must be a string')) {
      errorMsg = 'Browser compatibility error. Please refresh the page and try again.'
    } else if (errorMsg.includes('using deprecated parameters')) {
      errorMsg = 'SDK version mismatch. Please clear cache and refresh the page.'
    } else if (errorMsg.includes('localStorage') || errorMsg.includes('storage')) {
      errorMsg = 'Browser storage error. Please enable cookies/localStorage and try again.'
    } else if (errorMsg.toLowerCase().includes('user rejected')) {
      errorMsg = '❌ Payment cancelled. Please approve the Phantom popup to continue.'
    }
    
    throw new Error(`❌ Deposit failed: ${errorMsg}`)
  }
}

/**
 * ✅ FUNGSI EKSTRAKSI SIGNATURE - HANDLE BERBAGAI FORMAT
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
    
    if (rawSignature.signature instanceof Uint8Array) {
      return rawSignature.signature
    }
    
    if (Array.isArray(rawSignature.signature)) {
      return Uint8Array.from(rawSignature.signature)
    }
    
    if (rawSignature.signature.buffer instanceof ArrayBuffer) {
      return new Uint8Array(rawSignature.signature.buffer)
    }
    
    console.warn('⚠️ Unsupported signature object format:', rawSignature)
    throw new Error('Unsupported signature format from wallet')
  }
  
  // ✅ Case 3: Array biasa
  if (Array.isArray(rawSignature)) {
    console.log('✅ Signature is standard array')
    return Uint8Array.from(rawSignature)
  }
  
  // ✅ Case 4: ArrayBuffer atau Buffer
  if (rawSignature?.buffer instanceof ArrayBuffer) {
    console.log('✅ Signature is ArrayBuffer/Buffer')
    return new Uint8Array(rawSignature.buffer)
  }
  
  // ✅ Case 5: String (hex)
  if (typeof rawSignature === 'string') {
    console.log('✅ Signature is string - attempting hex conversion')
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
    const seed = signature.slice(0, 32)
    console.log('✅ Seed extracted from signature')
    
    const hash = nacl.hash(seed)
    console.log('✅ Hash computed successfully')
    
    const encryptionKey = new Uint8Array(hash.slice(0, 32))
    console.log('✅ Encryption key created')
    
    return encryptionKey
  } catch (hashErr) {
    console.error('❌ Failed to generate encryption key:', hashErr)
    throw new Error('Failed to generate encryption key from signature')
  }
}
