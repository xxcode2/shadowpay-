import { Router, Request, Response } from 'express';
import { createLink } from '../privacy/linkManager.js';

const router = Router();

interface DepositRequest {
  amount: number;
  assetType: 'SOL' | 'USDC' | 'USDT';
  depositTx: string; // Transaction hash from frontend SDK
}

/**
 * POST /api/deposit
 * 
 * Frontend flow:
 * 1. User connects wallet
 * 2. Frontend calls SDK: privacyCash.deposit(amount)
 * 3. SDK handles: ZK proof, Merkle tree, transaction signing
 * 4. SDK relays to Privacy Cash relayer
 * 5. Frontend sends transaction hash to backend
 * 6. Backend creates payment link
 * 
 * Backend only creates link metadata
 */
router.post('/', async (req: Request<{}, {}, DepositRequest>, res: Response) => {
  try {
    const { amount, assetType, depositTx } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    if (!['SOL', 'USDC', 'USDT'].includes(assetType)) {
      res.status(400).json({ error: 'Invalid asset type. Must be SOL, USDC, or USDT' });
      return;
    }

    if (!depositTx || typeof depositTx !== 'string') {
      res.status(400).json({ error: 'Deposit transaction hash required' });
      return;
    }

    // Create payment link
    const linkId = createLink(amount, assetType, depositTx);

    res.json({
      success: true,
      linkId,
      depositTx,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    });
  }
});

export default router;

