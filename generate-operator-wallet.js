#!/usr/bin/env node

/**
 * Generate new clean Solana wallet for operator
 * Output format compatible with ShadowPay backend
 */

import { Keypair } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'

console.log('\n🔐 Generating NEW clean Solana wallet for operator...\n')

// Generate new keypair
const keypair = Keypair.generate()

// Get public key
const publicKey = keypair.publicKey.toString()

// Get secret key as array
const secretKeyArray = Array.from(keypair.secretKey)

// Save to file
const keyFile = path.join(process.cwd(), 'operator-key.json')
fs.writeFileSync(keyFile, JSON.stringify(keypair, null, 2))

// Display results
console.log('✅ Wallet generated successfully!\n')
console.log('📁 Saved to:', keyFile)
console.log('')
console.log('💰 PUBLIC KEY (for topping up):')
console.log(`   ${publicKey}\n`)
console.log('🔑 PRIVATE KEY (for Railway):')
console.log(`   ${secretKeyArray.join(',')}\n`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\n📋 NEXT STEPS:\n')
console.log('1️⃣  SEND SOL TO PUBLIC KEY:')
console.log(`    ${publicKey}`)
console.log('    Send 0.1 SOL using Phantom or any exchange\n')
console.log('2️⃣  Update OPERATOR_SECRET_KEY in Railway:')
console.log('    Go to: https://dashboard.railway.app')
console.log('    Project → Variables → OPERATOR_SECRET_KEY')
console.log('    Replace with the PRIVATE KEY above (comma-separated numbers)\n')
console.log('3️⃣  Redeploy backend in Railway (auto-deploy on git push)\n')
console.log('4️⃣  Test deposit in ShadowPay\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Copy to clipboard helper
console.log('💡 TIP: Copy the private key and paste to Railway:\n')
console.log(secretKeyArray.join(','))
console.log('\n')
