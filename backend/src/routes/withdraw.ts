import { Router, Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import prisma from '../lib/prisma.js';

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
 * Backend records the withdrawal and marks link as claimed.
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
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // 🔐 Prevent double-claim
    if (link.claimed) {
      return res.status(400).json({ error: 'Link already claimed' });
    }

    // ✅ Mark link as claimed and save withdrawal transaction
    const updatedLink = await prisma.paymentLink.update({
      where: { id: linkId },
      data: {
        claimed: true,
        claimedBy: recipientAddress,
        withdrawTx,
      },
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        type: 'withdraw',
        linkId,
        transactionHash: withdrawTx,
        amount: link.amount,
        assetType: link.assetType,
        toAddress: recipientAddress,
        status: 'confirmed',
      },
    });

    return res.json({
      success: true,
      message: 'Withdrawal recorded and link claimed',
      withdrawTx,
      link: updatedLink,
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Withdrawal failed',
    });
  }
});

export default router;

