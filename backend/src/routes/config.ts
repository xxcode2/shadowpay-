import { Router, Request, Response } from 'express'

const router = Router()

/**
 * GET /api/config
 * 
 * ✅ PUBLIC CONFIG ENDPOINT
 * Returns public configuration for frontend
 * - Fee structure
 * - Min amount
 * - Network info
 * - Operator wallet address (for user payments)
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const operatorAddress = process.env.OPERATOR_ADDRESS || process.env.OPERATOR_PUBKEY
    
    if (!operatorAddress) {
      console.warn('⚠️  OPERATOR_ADDRESS not configured in environment')
    }
    
    res.json({
      minAmount: 0.01,
      network: process.env.SOLANA_NETWORK || 'mainnet-beta',
      operatorAddress: operatorAddress || 'NOT_CONFIGURED',
      fees: {
        depositFee: 0,
        baseFee: 0.006,
        protocolFeePercent: 0.35,
        description: '0.006 SOL + 0.35% of withdrawal amount',
        note: 'Fees charged when recipient claims the link',
      },
      operator: 'ShadowPay relayer service',
      operatorEmail: process.env.OPERATOR_EMAIL || 'support@shadowpay.app',
    })
  } catch (err: any) {
    console.error('❌ Config endpoint error:', err.message)
    return res.status(500).json({
      error: 'Failed to load configuration',
      details:
        process.env.NODE_ENV === 'development'
          ? err.message
          : undefined,
    })
  }
})

export default router
