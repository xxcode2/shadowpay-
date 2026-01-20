import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/link/:id
 * Retrieve payment link details (read-only)
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;

    const link = await prisma.paymentLink.findUnique({
      where: { id },
    });

    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    res.json({
      id: link.id,
      amount: link.amount,
      assetType: link.assetType,
      claimed: link.claimed,
      claimedBy: link.claimedBy || null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    });
  } catch (error) {
    console.error('Link lookup error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Link lookup failed',
    });
  }
});

/**
 * GET /api/link
 * List all links (for admin/testing)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const links = await prisma.paymentLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(links);
  } catch (error) {
    console.error('Links list error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list links',
    });
  }
});

export default router;
