import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import depositRouter from './routes/deposit.js';
import withdrawRouter from './routes/withdraw.js';
import linkRouter from './routes/link.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/deposit', depositRouter);
app.use('/api/withdraw', withdrawRouter);
app.use('/api/link', linkRouter);

// Error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Error:', err);
    res.status(500).json({
      error: err.message || 'Internal server error',
    });
  }
);

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`🚀 ShadowPay Backend listening on port ${PORT}`);
  console.log(`📍 Network: Solana Mainnet (Helius RPC)`);
  console.log(`📝 Privacy Cash SDK: Frontend-only, running in user browsers`);
});


