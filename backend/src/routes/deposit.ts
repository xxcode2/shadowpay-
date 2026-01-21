import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * Request body from frontend
 * Frontend ONLY sends intent, not transaction hash
 */
interface DepositRequest {
  amount: number;
  assetType: 'SOL'; // lock to SOL for now
  senderAddress: string;   // wallet public key
}

/**
 * POST /api/deposit
 *
 * Correct flow:
 * 1. Frontend sends { amount, assetType, sender }
 * 2. Backend performs Privacy Cash deposit (or mock for now)
 * 3. Backend stores depositTx + link metadata
 * 4. Backend returns linkId
 */
router.post('/', async (req: Request<{}, {}, DepositRequest>, res: Response) => {
  try {
    // ================= DEBUG LOG =================
    console.log('DEPOSIT BODY:', req.body);

    const { amount, assetType, senderAddress } = req.body;

    // ================= VALIDATION =================
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (assetType !== 'SOL') {
      return res.status(400).json({ error: 'Only SOL is supported' });
    }

    if (!senderAddress || typeof senderAddress !== 'string') {
      return res.status(400).json({ error: 'Sender wallet address required' });
    }

    /**
     * TODO:
     * Replace this with REAL Privacy Cash SDK call:
     *
     * const { tx, commitment } = await privacyCash.deposit(...)
     */
    const mockDepositTx = `mock_deposit_${Date.now()}`;
    const mockCommitment = `mock_commitment_${Date.now()}`;

    // ================= CREATE LINK =================
    const link = await prisma.paymentLink.create({
      data: {
        amount,
        assetType,
        depositTx: mockDepositTx,
        commitment: mockCommitment,
      },
    });

    // ================= TRANSACTION LOG =================
    await prisma.transaction.create({
      data: {
        type: 'deposit',
        linkId: link.id,
        transactionHash: mockDepositTx,
        amount,
        assetType,
        fromAddress: senderAddress,
        status: 'confirmed',
      },
    });

    return res.json({
      success: true,
      linkId: link.id,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Deposit failed',
    });
  }
});

export default router;
