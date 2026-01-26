/**
 * Health Check Endpoint
 * Monitors Privacy Cash SDK and backend health status
 */

import express, { Router, Request, Response } from 'express';
import { PRIVACY_CASH_CONFIG, validatePrivacyCashConfig } from '../config.js';
import { performHealthCheck } from '../utils/privacyCashOperations.js';
import { getOperatorKeypair } from '../services/privacyCash.js';

const router = Router();

/**
 * GET /api/health
 * Returns comprehensive backend health status
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();

    // Configuration validation
    const configValidation = validatePrivacyCashConfig();
    
    // Check operator keypair
    let operatorStatus = 'error';
    let operatorMessage = 'Not configured';
    
    try {
      const keypair = getOperatorKeypair();
      operatorStatus = keypair ? 'active' : 'inactive';
      operatorMessage = keypair ? `Public key: ${keypair.publicKey.toString()}` : 'No keypair found';
    } catch (err) {
      operatorMessage = err instanceof Error ? err.message : 'Unknown error';
    }

    // Perform full health check
    let privacyCashHealth: any = {
      status: 'unknown',
      message: 'Health check not performed',
    };

    try {
      privacyCashHealth = await performHealthCheck();
    } catch (err) {
      privacyCashHealth = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    const responseTime = Date.now() - startTime;

    // Build response
    const health = {
      status: 'healthy' as const,
      message: 'Backend health status',
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      components: {
        configuration: {
          status: configValidation.isValid ? 'valid' : 'invalid',
          errors: configValidation.errors,
          warnings: configValidation.warnings,
        },
        operator: {
          status: operatorStatus,
          message: operatorMessage,
        },
        privacyCash: privacyCashHealth,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        rpcUrl: PRIVACY_CASH_CONFIG.rpcUrl,
        debugMode: PRIVACY_CASH_CONFIG.enableDebug,
      },
    };

    res.json(health);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      status: 'error',
      error,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/config
 * Returns current Privacy Cash configuration (without secrets)
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const configValidation = validatePrivacyCashConfig();

    const config = {
      valid: configValidation.isValid,
      withdrawal: PRIVACY_CASH_CONFIG.withdrawal,
      operator: PRIVACY_CASH_CONFIG.operator,
      monitoring: PRIVACY_CASH_CONFIG.monitoring,
      errors: configValidation.errors,
      warnings: configValidation.warnings,
    };

    res.json(config);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error });
  }
});

/**
 * GET /api/health/operator
 * Returns operator wallet status and balance information
 */
router.get('/operator', async (req: Request, res: Response) => {
  try {
    const operatorKeypair = getOperatorKeypair();

    if (!operatorKeypair) {
      return res.status(400).json({
        error: 'Operator keypair not configured',
        message: 'Set OPERATOR_SECRET_KEY environment variable',
      });
    }

    const publicKey = operatorKeypair.publicKey.toString();

    // Try to get balance (this may fail if RPC is down)
    let balance = null;
    let balanceError = null;

    try {
      const { Connection } = await import('@solana/web3.js');
      const connection = new Connection(PRIVACY_CASH_CONFIG.rpcUrl, 'confirmed');
      const balanceLamports = await connection.getBalance(operatorKeypair.publicKey);
      balance = {
        lamports: balanceLamports,
        sol: balanceLamports / 1_000_000_000,
      };
    } catch (err) {
      balanceError = err instanceof Error ? err.message : 'Unable to fetch balance';
    }

    res.json({
      publicKey,
      balance,
      balanceError,
      minRequired: PRIVACY_CASH_CONFIG.operator.minBalance,
      recommended: PRIVACY_CASH_CONFIG.operator.recommendedBalance,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error });
  }
});

/**
 * GET /api/health/rpc
 * Test RPC connectivity
 */
router.get('/rpc', async (req: Request, res: Response) => {
  try {
    const { Connection } = await import('@solana/web3.js');
    const connection = new Connection(PRIVACY_CASH_CONFIG.rpcUrl, 'confirmed');

    const startTime = Date.now();
    const version = await connection.getVersion();
    const latency = Date.now() - startTime;

    res.json({
      connected: true,
      latencyMs: latency,
      rpcUrl: PRIVACY_CASH_CONFIG.rpcUrl,
      version: version['solana-core'],
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      connected: false,
      error,
      rpcUrl: PRIVACY_CASH_CONFIG.rpcUrl,
    });
  }
});

export default router;
