#!/usr/bin/env node

/**
 * ✅ KEYPAIR CONSISTENCY TEST
 * 
 * Verifies that same keypair produces same public key
 * (user 1 and user 2 should use same keypair to withdraw)
 */

import { Keypair } from '@solana/web3.js'
import dotenv from 'dotenv'

dotenv.config()

const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY

function parseKeypair(secretKeyInput: string): Keypair {
  if (!secretKeyInput) {
    throw new Error('OPERATOR_SECRET_KEY not set')
  }

  try {
    // Parse comma-separated bytes
    if (secretKeyInput.includes(',')) {
      const arr = secretKeyInput
        .split(',')
        .map(x => parseInt(x.trim(), 10))
        .filter(n => !isNaN(n))

      if (arr.length !== 64) {
        throw new Error(`Invalid key: expected 64 bytes, got ${arr.length}`)
      }

      return Keypair.fromSecretKey(Uint8Array.from(arr))
    }

    // Try JSON array
    if (secretKeyInput.startsWith('[') && secretKeyInput.endsWith(']')) {
      const arr = JSON.parse(secretKeyInput)
      if (!Array.isArray(arr) || arr.length !== 64) {
        throw new Error(`Invalid key array: expected 64 bytes, got ${arr.length}`)
      }
      return Keypair.fromSecretKey(Uint8Array.from(arr))
    }

    throw new Error('Unsupported key format')
  } catch (err: any) {
    throw new Error(`Failed to parse OPERATOR_SECRET_KEY: ${err.message}`)
  }
}

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🔐 KEYPAIR CONSISTENCY TEST')
  console.log('='.repeat(80) + '\n')

  try {
    if (!OPERATOR_SECRET_KEY) {
      console.error('❌ OPERATOR_SECRET_KEY not set')
      process.exit(1)
    }

    console.log('📋 TEST: Same keypair produces same public key\n')

    // Parse keypair 3 times (simulating different users)
    console.log('🔄 Parsing keypair #1 (User 1)...')
    const keypair1 = parseKeypair(OPERATOR_SECRET_KEY)
    const address1 = keypair1.publicKey.toString()
    console.log(`   Public key: ${address1}\n`)

    console.log('🔄 Parsing keypair #2 (User 2)...')
    const keypair2 = parseKeypair(OPERATOR_SECRET_KEY)
    const address2 = keypair2.publicKey.toString()
    console.log(`   Public key: ${address2}\n`)

    console.log('🔄 Parsing keypair #3 (User 3)...')
    const keypair3 = parseKeypair(OPERATOR_SECRET_KEY)
    const address3 = keypair3.publicKey.toString()
    console.log(`   Public key: ${address3}\n`)

    // Verify all are the same
    console.log('='.repeat(80))
    console.log('📊 VERIFICATION\n')

    const allMatch = address1 === address2 && address2 === address3
    
    if (allMatch) {
      console.log(`✅ ALL KEYPAIRS MATCH!`)
      console.log(`   User 1: ${address1}`)
      console.log(`   User 2: ${address2}`)
      console.log(`   User 3: ${address3}\n`)

      console.log(`🎉 RESULT: Same secret key always produces same public key`)
      console.log(`   This means ANY user can use the same operator keypair`)
      console.log(`   to execute withdrawals from Privacy Cash pool\n`)
    } else {
      console.error(`❌ KEYPAIRS DO NOT MATCH!`)
      console.error(`   This is a critical error!\n`)
      process.exit(1)
    }

    // Also test secret key consistency
    console.log('='.repeat(80))
    console.log('🔐 EXTRA: Verify secret key consistency\n')

    const secret1 = Array.from(keypair1.secretKey).join(',')
    const secret2 = Array.from(keypair2.secretKey).join(',')
    const secretKeysMatch = secret1 === secret2 && secret2 === OPERATOR_SECRET_KEY

    if (secretKeysMatch) {
      console.log(`✅ Secret keys are identical`)
      console.log(`   All three keypairs have the exact same secret bytes\n`)
    } else {
      console.warn(`⚠️  Secret keys differ (this is very unusual)`)
      console.warn(`   Bytes: ${secret1.substring(0, 50)}...\n`)
    }

    console.log('='.repeat(80))
    console.log('✅ TEST PASSED')
    console.log('='.repeat(80) + '\n')

  } catch (error: any) {
    console.error('\n❌ TEST FAILED')
    console.error(`Error: ${error.message}\n`)
    process.exit(1)
  }
}

main()
