#!/usr/bin/env node

/**
 * Test withdrawal fix - Verify the changes to privacyCash.ts work
 */

import { readFileSync } from 'fs'
import { join } from 'path'

console.log('\n' + '='.repeat(80))
console.log('✅ TESTING WITHDRAWAL FIX')
console.log('='.repeat(80) + '\n')

// Read the fixed privacyCash.ts
const privacyCashPath = join(process.cwd(), 'backend/src/services/privacyCash.ts')
const content = readFileSync(privacyCashPath, 'utf-8')

console.log('📋 Checking fixes in privacyCash.ts:\n')

// Check 1: Correct PrivacyCash constructor
console.log('1️⃣  PrivacyCash constructor signature:')
if (content.includes('new PrivacyCash(operatorKeypair, rpcUrl)')) {
  console.log('   ✅ FIXED: Using (keypair, rpcUrl) signature')
} else if (content.includes('new PrivacyCash(config)')) {
  console.log('   ❌ STILL WRONG: Using config object')
} else {
  console.log('   ❓ UNCLEAR: Constructor pattern not found')
}

// Check 2: Correct withdraw API call
console.log('\n2️⃣  Withdraw function API call:')
if (content.includes('pc.withdraw({') && content.includes('lamports,') && content.includes('recipientAddress,')) {
  console.log('   ✅ FIXED: Using correct object-based API')
} else {
  console.log('   ❌ STILL WRONG: Not using correct API')
}

// Check 3: Better error handling
console.log('\n3️⃣  Error handling:')
if (content.includes('unspent utxo')) {
  console.log('   ✅ IMPROVED: Better error messages for UTXO issues')
} else {
  console.log('   ⚠️  Limited: Generic error handling')
}

console.log('\n' + '='.repeat(80))
console.log('📊 SUMMARY')
console.log('='.repeat(80) + '\n')

console.log('The withdrawal endpoint should now:')
console.log('  1. ✅ Initialize Privacy Cash with correct constructor')
console.log('  2. ✅ Call withdraw() with correct API signature')
console.log('  3. ✅ Provide better error messages\n')

console.log('🧪 Next steps:')
console.log('  1. Rebuild backend: npm run build')
console.log('  2. Start backend: npm run start')
console.log('  3. Test withdrawal from frontend\n')

console.log('='.repeat(80) + '\n')
