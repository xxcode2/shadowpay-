#!/usr/bin/env ts-node
/**
 * EMERGENCY FIX: Test SDK.deposit() directly
 * This script will call SDK.deposit() and show exact error
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { loadKeypairFromEnv } from './src/services/keypairManager.js'

const RPC_URL = process.env.SOLANA_RPC_URL || 
  'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

async function test() {
  console.log('\n🔍 TESTING SDK.DEPOSIT() DIRECTLY\n')
  
  try {
    console.log('1. Loading operator keypair...')
    const keypair = loadKeypairFromEnv()
    console.log(`   ✅ Loaded: ${keypair.publicKey.toBase58()}`)
    
    console.log('\n2. Testing RPC connection...')
    const connection = new Connection(RPC_URL, 'confirmed')
    const version = await connection.getVersion()
    console.log(`   ✅ RPC OK: ${version['solana-core']}`)
    
    console.log('\n3. Checking balance...')
    const balance = await connection.getBalance(keypair.publicKey)
    console.log(`   ✅ Balance: ${balance / LAMPORTS_PER_SOL} SOL`)
    
    console.log('\n4. Importing PrivacyCash...')
    const { PrivacyCash } = await import('privacycash')
    console.log(`   ✅ Imported`)
    
    console.log('\n5. Initializing SDK...')
    const pc = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: keypair,
      enableDebug: true
    })
    console.log(`   ✅ Initialized`)
    
    console.log('\n6. Testing SDK.deposit() with small amount...')
    console.log('   Calling: pc.deposit({ lamports: 1000 })')
    console.log('   (Waiting... this might take a while)')
    
    const startTime = Date.now()
    const result = await pc.deposit({ lamports: 1000 })
    const elapsed = Date.now() - startTime
    
    console.log(`   ✅ SUCCESS! (took ${elapsed}ms)`)
    console.log(`\n📋 RESPONSE:`)
    console.log(`   Type: ${typeof result}`)
    console.log(`   Keys: ${Object.keys(result).join(', ')}`)
    console.log(`   Response: ${JSON.stringify(result).substring(0, 300)}...`)
    
  } catch (error: any) {
    console.error(`\n❌ ERROR:`)
    console.error(`   Name: ${error.name}`)
    console.error(`   Message: ${error.message}`)
    console.error(`   String: ${String(error)}`)
    
    if (error.response) {
      console.error(`\n   HTTP Response:`)
      console.error(`   Status: ${error.response.status}`)
      console.error(`   Data: ${JSON.stringify(error.response.data)}`)
    }
    
    console.error(`\n   Full Stack:`)
    console.error(`   ${error.stack}`)
    
    console.error(`\n   Object Keys:`)
    console.error(`   ${Object.keys(error).join(', ')}`)
  }
}

test()
