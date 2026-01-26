/**
 * SPL Token API Routes
 * Endpoints for SPL token deposit, withdrawal, and balance queries
 */

import express, { Router, Request, Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import {
  processSPLTokenWithdrawal,
  estimateSPLTokenWithdrawalFee,
  checkSPLBalance,
  getSupportedSPLTokensList,
  createSPLWithdrawalErrorResponse,
  validateSPLTokenAllowed,
} from '../utils/splTokenWithdrawal.js'
import { getPrivacyCashClient, depositSPLToken } from '../services/privacyCash.js'

const router = Router()

/**
 * GET /api/tokens/supported
 * Get list of all supported SPL tokens
 */
router.get('/supported', (req: Request, res: Response) => {
  try {
    const tokens = getSupportedSPLTokensList()

    res.json({
      count: tokens.length,
      tokens: tokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        decimals: t.decimals,
        depositFee: t.depositFee,
        withdrawalFee: t.withdrawalFee,
      })),
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error })
  }
})

/**
 * POST /api/tokens/deposit
 * Deposit SPL token into Privacy Cash pool
 */
router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { mintAddress, amount, base_units, linkId } = req.body

    if (!mintAddress) {
      return res.status(400).json({ error: 'mintAddress is required' })
    }

    if (!amount && !base_units) {
      return res.status(400).json({ error: 'Either amount or base_units must be provided' })
    }

    // Validate token is supported
    const validation = validateSPLTokenAllowed(mintAddress)
    if (!validation.isAllowed) {
      return res.status(400).json({ error: validation.error })
    }

    const pc = getPrivacyCashClient()

    console.log(`💰 SPL Token Deposit Request`)
    console.log(`   Token: ${validation.token}`)
    console.log(`   Amount: ${amount || base_units}`)
    console.log(`   Link ID: ${linkId}`)

    const result = await depositSPLToken(pc, mintAddress, amount, base_units)

    res.json({
      success: true,
      tx: result.tx,
      token: validation.token,
      linkId,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error, timestamp: new Date().toISOString() })
  }
})

/**
 * POST /api/tokens/withdraw
 * Withdraw SPL token from Privacy Cash pool
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { mintAddress, amount, base_units, recipientAddress, linkId } = req.body

    if (!mintAddress) {
      return res.status(400).json({ error: 'mintAddress is required' })
    }

    if (!recipientAddress) {
      return res.status(400).json({ error: 'recipientAddress is required' })
    }

    if (!amount && !base_units) {
      return res.status(400).json({ error: 'Either amount or base_units must be provided' })
    }

    // Validate token is supported
    const validation = validateSPLTokenAllowed(mintAddress)
    if (!validation.isAllowed) {
      return res.status(400).json({ error: validation.error })
    }

    console.log(`💸 SPL Token Withdrawal Request`)
    console.log(`   Token: ${validation.token}`)
    console.log(`   Amount: ${amount || base_units}`)
    console.log(`   Recipient: ${recipientAddress.substring(0, 8)}...`)
    console.log(`   Link ID: ${linkId}`)

    const result = await processSPLTokenWithdrawal(mintAddress, amount, base_units, recipientAddress)

    res.json({
      success: true,
      tx: result.tx,
      token: validation.token,
      recipient: result.recipient,
      baseUnitsReceived: result.baseUnitsReceived,
      baseFeeCharged: result.baseFeeCharged,
      isPartial: result.isPartial,
      message: result.message,
      linkId,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const error = createSPLWithdrawalErrorResponse(err, req.body)
    res.status(500).json(error)
  }
})

/**
 * GET /api/tokens/:mintAddress/balance
 * Get SPL token balance
 */
router.get('/:mintAddress/balance', async (req: Request, res: Response) => {
  try {
    const { mintAddress } = req.params

    if (!mintAddress) {
      return res.status(400).json({ error: 'mintAddress is required' })
    }

    // Validate token is supported
    const validation = validateSPLTokenAllowed(mintAddress)
    if (!validation.isAllowed) {
      return res.status(400).json({ error: validation.error })
    }

    const balance = await checkSPLBalance(mintAddress)

    res.json({
      token: validation.token,
      mint: mintAddress,
      balance: balance.balance,
      formatted: balance.formatted,
      hasSufficientBalance: balance.hasSufficientBalance,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error, timestamp: new Date().toISOString() })
  }
})

/**
 * POST /api/tokens/fee-estimate
 * Get withdrawal fee estimate for SPL token
 */
router.post('/fee-estimate', async (req: Request, res: Response) => {
  try {
    const { mintAddress, amount, base_units } = req.body

    if (!mintAddress) {
      return res.status(400).json({ error: 'mintAddress is required' })
    }

    if (!amount && !base_units) {
      return res.status(400).json({ error: 'Either amount or base_units must be provided' })
    }

    // Validate token is supported
    const validation = validateSPLTokenAllowed(mintAddress)
    if (!validation.isAllowed) {
      return res.status(400).json({ error: validation.error })
    }

    const estimate = await estimateSPLTokenWithdrawalFee(mintAddress, amount, base_units)

    res.json({
      mint: mintAddress,
      ...estimate,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error, timestamp: new Date().toISOString() })
  }
})

/**
 * GET /api/tokens/info/:symbol
 * Get info about a specific token by symbol
 */
router.get('/info/:symbol', (req: Request, res: Response) => {
  try {
    const { symbol } = req.params

    const tokens = getSupportedSPLTokensList()
    const token = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase())

    if (!token) {
      return res.status(404).json({ error: `Token ${symbol} not found` })
    }

    res.json({
      ...token,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error })
  }
})

export default router
