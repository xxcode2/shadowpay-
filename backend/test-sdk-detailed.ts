import { Keypair, Connection, PublicKey } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'

// @ts-ignore
import { PrivacyCash } from 'privacycash'

async function main() {
  try {
    console.log('\n===== SDK DEPOSIT DETAILED TEST =====\n')

    // 1. Load operator keypair
    console.log('STEP 1: Loading operator keypair...')
    // Try multiple paths
    let secretKeyPath = path.join(process.cwd(), 'operator-key.json')
    if (!fs.existsSync(secretKeyPath)) {
      secretKeyPath = path.join(process.cwd(), '..', 'operator-key.json')
    }
    if (!fs.existsSync(secretKeyPath)) {
      secretKeyPath = '/workspaces/shadowpay-/operator-key.json'
    }
    
    if (!fs.existsSync(secretKeyPath)) {
      throw new Error(`Operator key not found at ${secretKeyPath}`)
    }

    const secretKeyStr = fs.readFileSync(secretKeyPath, 'utf-8')
    const secretKeyObj = JSON.parse(secretKeyStr)
    const secretKey = Array.isArray(secretKeyObj) ? secretKeyObj : secretKeyObj.secret_key || secretKeyObj.secretKey
    const operatorKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey))
    
    console.log(`✅ Operator public key: ${operatorKeypair.publicKey.toString()}`)
    console.log(`✅ Keypair loaded successfully`)

    // 2. Setup RPC
    console.log('\nSTEP 2: Connecting to RPC...')
    const RPC_URL = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY
    console.log(`✅ RPC URL: ${RPC_URL.substring(0, 50)}...`)

    const connection = new Connection(RPC_URL)
    const balance = await connection.getBalance(operatorKeypair.publicKey)
    console.log(`✅ Operator balance: ${balance / 1e9} SOL`)

    // 3. Initialize SDK
    console.log('\nSTEP 3: Initializing Privacy Cash SDK...')
    const privacyCashClient = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: operatorKeypair,
      enableDebug: true,
    })
    console.log(`✅ SDK initialized`)

    // 4. Attempt deposit with detailed logging
    console.log('\nSTEP 4: Calling SDK.deposit({ lamports: 1000000 })...')
    console.log('   This is where the error occurs...\n')

    const depositAmount = 1000000 // 0.001 SOL for testing

    try {
      console.log(`   [SDK] Making deposit request...`)
      const result = await privacyCashClient.deposit({
        lamports: depositAmount,
      })

      console.log(`\n✅ SDK.deposit() SUCCEEDED!`)
      console.log(`   Result type: ${typeof result}`)
      console.log(`   Result keys: ${result ? Object.keys(result).join(', ') : 'null'}`)
      console.log(`   Result structure:`)
      if (result) {
        if (result.tx) console.log(`   - tx field: ${typeof result.tx} (length: ${result.tx?.length})`)
        if (result.transaction) console.log(`   - transaction field: ${typeof result.transaction} (length: ${result.transaction?.length})`)
        if (result.proof) console.log(`   - proof field: present`)
        if (result.signature) console.log(`   - signature field: present`)
      }

    } catch (err: any) {
      console.log(`\n❌ SDK.deposit() FAILED!`)
      console.log(`   Error message: ${err.message}`)
      console.log(`   Error type: ${err.constructor.name}`)
      console.log(`   Error code: ${err.code}`)
      
      if (err.response) {
        console.log(`   HTTP Status: ${err.response.status}`)
        console.log(`   HTTP Status Text: ${err.response.statusText}`)
        console.log(`   Response data: ${JSON.stringify(err.response.data).substring(0, 200)}`)
      }

      if (err.cause) {
        console.log(`   Cause: ${err.cause}`)
      }

      console.log(`\n   Full error object:`)
      console.log(JSON.stringify(err, null, 2).substring(0, 500))

      // Try to call it again with different parameters
      console.log(`\n   Attempting retry with different parameters...`)
      try {
        const retryResult = await privacyCashClient.deposit({
          lamports: 500000, // Smaller amount
        })
        console.log(`   ✅ Retry succeeded with 500000 lamports`)
      } catch (retryErr: any) {
        console.log(`   ❌ Retry also failed: ${retryErr.message}`)
      }
    }

    console.log('\n===== TEST COMPLETE =====\n')

  } catch (err: any) {
    console.error(`\n❌ FATAL ERROR: ${err.message}`)
    console.error(err.stack)
    process.exit(1)
  }
}

main()
