import { Router, Request, Response } from 'express';
import { getLink } from '../privacy/linkManager.js';

const router = Router();

/**
 * GET /link/:id
 * Retrieve payment link details (read-only)
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;

    const link = getLink(id);

    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    res.json({
      id: link.id,
      amount: link.amount,
      assetType: link.assetType,
      claimed: !!link.claimedAt,
      claimedBy: link.claimedBy || null,
      createdAt: link.createdAt,
      claimedAt: link.claimedAt || null,
    });
  } catch (error) {
    console.error('Link lookup error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Link lookup failed',
    });
  }
});

export default router;
