import { Router, Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { getLink, claimLink } from '../privacy/linkManager.js';

const router = Router();

interface WithdrawRequest {
  linkId: string;
  recipientAddress: string;
  withdrawTx: string;
}

/**
 * POST /api/withdraw
 *
 * Called AFTER Privacy Cash SDK withdraw succeeds on frontend.
 * Backend only records state.
 */
router.post('/', async (req: Request<{}, {}, WithdrawRequest>, res: Response) => {
  try {
    const { linkId, recipientAddress, withdrawTx } = req.body;

    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'Link ID required' });
    }

    if (!recipientAddress) {
      return res.status(400).json({ error: 'Recipient address required' });
    }

    if (!withdrawTx || typeof withdrawTx !== 'string') {
      return res.status(400).json({ error: 'Withdraw transaction hash required' });
    }

    // Validate Solana address
    try {
      new PublicKey(recipientAddress);
    } catch {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    // 🔐 Validate link exists
    const link = getLink(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // 🔐 Prevent double-claim
    if (link.claimedAt) {
      return res.status(400).json({ error: 'Link already claimed' });
    }

    // ✅ Mark link as claimed (ONLY after withdraw succeeded)
    const success = claimLink(linkId, recipientAddress);
    if (!success) {
      return res.status(400).json({ error: 'Failed to claim link' });
    }

    // (Optional, MVP ok to skip)
    // TODO: persist withdrawTx in DB

    return res.json({
      success: true,
      message: 'Withdrawal recorded and link claimed',
      withdrawTx,
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Withdrawal failed',
    });
  }
});

export default router;
