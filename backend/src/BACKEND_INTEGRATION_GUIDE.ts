/**
 * ShadowPay Backend Privacy Cash Integration Guide
 * 
 * This file documents the complete backend integration with Privacy Cash SDK
 * All operations, configurations, and endpoints are defined below
 */

// ============================================================================
// PART 1: ENVIRONMENT SETUP
// ============================================================================

const ENVIRONMENT_SETUP = {
  description: `
    Set these environment variables before starting the backend server:
    
    Required:
    - SOLANA_RPC_URL: Solana RPC endpoint (for on-chain verification)
    - OPERATOR_SECRET_KEY: Backend operator's private key (4 formats supported)
    - DATABASE_URL: PostgreSQL connection string
    
    Optional:
    - PRIVACY_CASH_PROGRAM: Custom Privacy Cash program ID
    - NODE_ENV: "production" or "development"
    - PORT: Server port (default: 3001)
  `,
  
  operatorSecretKeyFormats: `
    The backend accepts 4 private key formats:
    
    1. JSON Array (Recommended):
       OPERATOR_SECRET_KEY=[232,221,205,...,23]
       - 64 comma-separated integers (0-255)
       - Easiest to generate from Solana keypair
    
    2. Comma-Separated String:
       OPERATOR_SECRET_KEY=232,221,205,...,23
       - Same as JSON array but without brackets
    
    3. Base58 String:
       OPERATOR_SECRET_KEY=Hs1XkAzz2Vg6eEtR9mK2...
       - Solana CLI export format
       - Use: solana address
    
    4. JSON Keypair (Advanced):
       OPERATOR_SECRET_KEY={"_keypair":{"publicKey":[...]}}
       - Full Solana Keypair object serialized as JSON
  `,
};

// ============================================================================
// PART 2: BACKEND API ENDPOINTS
// ============================================================================

const API_ENDPOINTS = {
  
  // Health & Monitoring
  health: {
    endpoint: 'GET /api/health',
    description: 'Get comprehensive backend health status',
    response: {
      status: 'healthy | degraded | error',
      components: {
        configuration: { status: 'string', errors: [], warnings: [] },
        operator: { status: 'string', message: 'Public key or error' },
        privacyCash: { status: 'string', message: 'SDK status' },
      },
    },
  },
  
  healthConfig: {
    endpoint: 'GET /api/health/config',
    description: 'Get Privacy Cash withdrawal configuration',
    response: {
      withdrawal: { baseFee: 0.006, protocolFeePercentage: 0.0035, minAmount: 0.001, maxAmount: 100 },
      operator: { minBalance: 0.1, recommendedBalance: 1.0 },
    },
  },
  
  healthOperator: {
    endpoint: 'GET /api/health/operator',
    description: 'Check operator wallet balance',
    response: {
      publicKey: 'operator_public_key',
      balance: { lamports: 100000000, sol: 0.1 },
      minRequired: 0.1,
      recommended: 1.0,
    },
  },
  
  healthRpc: {
    endpoint: 'GET /api/health/rpc',
    description: 'Test RPC connectivity and latency',
    response: {
      connected: true,
      latencyMs: 250,
      version: 'x.y.z',
    },
  },
  
  // Payment Links
  createLink: {
    endpoint: 'POST /api/create-link',
    description: 'Create a new anonymous payment link',
    request: { amount: 'number (SOL)', memo: 'string (optional)' },
    response: { linkId: 'string', amount: 'number', depositRequired: 'number' },
  },
  
  getLink: {
    endpoint: 'GET /api/link/:id',
    description: 'Get payment link details',
    response: { 
      id: 'string', 
      amount: 'number', 
      claimed: 'boolean', 
      claimedBy: 'string | null', 
      depositTx: 'string | null', 
      withdrawTx: 'string | null' 
    },
  },
  
  // Deposits (Frontend -> Backend)
  recordDeposit: {
    endpoint: 'POST /api/deposit',
    description: 'Record frontend deposit transaction',
    request: { linkId: 'string', txHash: 'string' },
    response: { success: true, linkId: 'string', txHash: 'string', confirmed: 'boolean' },
  },
  
  // Withdrawals (Backend Core)
  claimLink: {
    endpoint: 'POST /api/claim-link',
    description: 'Claim link and execute withdrawal via Privacy Cash SDK',
    request: { linkId: 'string', recipientAddress: 'string (Solana address)' },
    response: {
      success: true,
      withdrawTx: 'transaction_hash',
      amount: 'number (SOL)',
      fee: { baseFee: 0.006, protocolFee: 'number', totalFee: 'number' },
      isPartial: 'boolean',
    },
  },
};

// ============================================================================
// PART 3: CORE SERVICES
// ============================================================================

const SERVICES = {
  
  privacyCash: {
    description: 'Main Privacy Cash SDK service',
    functions: {
      
      parseOperatorKeypair: {
        purpose: 'Parse operator secret key in any of 4 formats',
        signature: 'parseOperatorKeypair(secretKeyInput: string): Keypair',
        example: `
          const keypair = parseOperatorKeypair(process.env.OPERATOR_SECRET_KEY);
          console.log('Public Key:', keypair.publicKey.toString());
        `,
      },
      
      getPrivacyCashClient: {
        purpose: 'Get initialized Privacy Cash SDK client',
        signature: 'getPrivacyCashClient(): PrivacyCashSDK',
        example: `
          const pc = getPrivacyCashClient();
          const balance = await pc.queryBalance();
          console.log('Pool Balance:', balance);
        `,
      },
      
      queryPrivateBalance: {
        purpose: 'Query available balance from Privacy Cash pool',
        signature: 'queryPrivateBalance(pc: PrivacyCashSDK): { lamports, sol, formatted }',
        example: `
          const pc = getPrivacyCashClient();
          const balance = await queryPrivateBalance(pc);
          console.log('Available:', balance.sol, 'SOL');
        `,
      },
      
      executeWithdrawal: {
        purpose: 'Execute withdrawal transaction via Privacy Cash SDK',
        signature: 'executeWithdrawal(pc, lamports, recipientAddress): { tx, amount, fee }',
        example: `
          const result = await executeWithdrawal(
            pc,
            0.05 * 1_000_000_000,  // lamports
            'recipient_address'
          );
          console.log('Withdrawal TX:', result.tx);
        `,
      },
      
      formatWithdrawalError: {
        purpose: 'Map SDK errors to user-friendly messages',
        signature: 'formatWithdrawalError(error): { message, code, suggestion }',
      },
    },
  },
  
  privacyCashOperations: {
    description: 'Transaction verification and monitoring utilities',
    functions: {
      
      verifyWithdrawalTransaction: {
        purpose: 'Verify withdrawal transaction on-chain with amount validation',
        signature: 'verifyWithdrawalTransaction(txHash, rpcUrl, expectedAmount)',
        example: `
          const verified = await verifyWithdrawalTransaction(
            'tx_hash',
            RPC_URL,
            0.05  // Expected amount in SOL
          );
          if (verified.isConfirmed) {
            console.log('✅ Withdrawal confirmed on-chain');
          }
        `,
      },
      
      monitorTransactionStatus: {
        purpose: 'Poll transaction until confirmed or max retries',
        signature: 'monitorTransactionStatus(txHash, rpcUrl, maxRetries=10, delayMs=3000)',
        example: `
          const status = await monitorTransactionStatus(txHash, RPC_URL);
          console.log('Slot:', status.slot, 'Confirmations:', status.confirmations);
        `,
      },
      
      checkOperatorWalletBalance: {
        purpose: 'Check operator SOL balance and verify minimum requirement',
        signature: 'checkOperatorWalletBalance(rpcUrl): { sol, lamports, hasSufficientBalance }',
        example: `
          const balance = await checkOperatorWalletBalance(RPC_URL);
          if (!balance.hasSufficientBalance) {
            console.warn('⚠️ Operator balance too low');
          }
        `,
      },
      
      performHealthCheck: {
        purpose: 'Full backend health check including privacy cash SDK',
        signature: 'performHealthCheck(): { status, message }',
      },
    },
  },
};

// ============================================================================
// PART 4: WITHDRAWAL FLOW
// ============================================================================

const WITHDRAWAL_FLOW = {
  description: 'How backend processes withdrawals',
  
  steps: [
    {
      step: 1,
      name: 'Receive Claim Request',
      details: `
        Frontend sends claim request with:
        - linkId: ID of payment link to claim
        - recipientAddress: Recipient's Solana wallet address
      `,
    },
    {
      step: 2,
      name: 'Validate Request',
      details: `
        Backend checks:
        - Link exists in database
        - Link not already claimed
        - Recipient address is valid Solana format
        - Deposit was confirmed on-chain
      `,
    },
    {
      step: 3,
      name: 'Execute Withdrawal',
      details: `
        Call Privacy Cash SDK:
        pc.withdraw({
          lamports: amountInLamports,
          recipientAddress: recipientAddress
        })
        
        Returns: transaction hash + amount received + fee charged
      `,
    },
    {
      step: 4,
      name: 'Verify On-Chain',
      details: `
        Monitor transaction for confirmation:
        - Poll RPC for transaction status
        - Verify amount matches expected
        - Check slot and confirmation count
      `,
    },
    {
      step: 5,
      name: 'Update Database',
      details: `
        Atomic transaction updates:
        - Mark link as claimed
        - Record recipient address
        - Store withdrawal transaction hash
        - Log transaction in history
      `,
    },
    {
      step: 6,
      name: 'Return Response',
      details: `
        Send to frontend:
        - success: true
        - withdrawTx: transaction hash
        - amount: final amount received
        - fee: breakdown of fees
      `,
    },
  ],
};

// ============================================================================
// PART 5: FEE STRUCTURE
// ============================================================================

const FEE_STRUCTURE = {
  description: 'How fees are calculated in ShadowPay',
  
  components: {
    baseFee: {
      amount: 0.006, // SOL
      description: 'Fixed fee charged for each withdrawal',
      recipient: 'Operator (backend) earns this',
    },
    
    protocolFee: {
      percentage: 0.0035, // 0.35%
      description: 'Percentage of withdrawal amount',
      calculation: 'amount * 0.0035',
      example: 'For 1 SOL withdrawal: 1 * 0.0035 = 0.0035 SOL protocol fee',
      recipient: 'Privacy Cash protocol',
    },
    
    networkFee: {
      amount: 0.002, // SOL (approximate)
      description: 'Solana network transaction fee',
      note: 'Covered by operator wallet, not charged separately',
    },
  },
  
  example: `
    Withdrawal Example:
    - User wants to withdraw: 1.0 SOL
    - Base fee: 0.006 SOL
    - Protocol fee (0.35%): 0.0035 SOL
    - Total fee: 0.0095 SOL
    - Recipient receives: 0.9905 SOL
    - Operator profit: 0.006 SOL
  `,
};

// ============================================================================
// PART 6: OPERATOR REQUIREMENTS
// ============================================================================

const OPERATOR_REQUIREMENTS = {
  description: 'Operator wallet requirements for running backend',
  
  minimumBalance: {
    amount: 0.1, // SOL
    purpose: 'Buffer for network fees and operations',
    warning: 'Backend will warn if balance falls below this',
  },
  
  recommendedBalance: {
    amount: 1.0, // SOL
    purpose: 'Safe operating margin for high-volume operations',
  },
  
  how_to_fund: `
    1. Get operator public key from environment setup
    2. Send SOL to that address via any wallet
    3. Monitor balance via:
       curl http://localhost:3001/api/health/operator
  `,
  
  cost_analysis: `
    Network fees per withdrawal: ~0.002 SOL
    Base fee earned per withdrawal: 0.006 SOL
    Net profit per withdrawal: ~0.004 SOL
    
    With 1.0 SOL balance:
    - Can process ~100 withdrawals before balance concerns
    - Base fees from users replenish balance
    - System is self-sustaining after initial funding
  `,
};

// ============================================================================
// PART 7: DEPLOYMENT CHECKLIST
// ============================================================================

const DEPLOYMENT_CHECKLIST = [
  '[ ] Set SOLANA_RPC_URL environment variable',
  '[ ] Set OPERATOR_SECRET_KEY environment variable',
  '[ ] Fund operator wallet with 0.1+ SOL',
  '[ ] Verify DATABASE_URL is set and accessible',
  '[ ] Run: npm run build',
  '[ ] Test health endpoint: curl http://localhost:3001/api/health',
  '[ ] Test operator balance: curl http://localhost:3001/api/health/operator',
  '[ ] Test RPC connection: curl http://localhost:3001/api/health/rpc',
  '[ ] Create test link and claim it',
  '[ ] Monitor logs for errors',
  '[ ] Set up monitoring for operator balance',
];

// ============================================================================
// PART 8: TROUBLESHOOTING
// ============================================================================

const TROUBLESHOOTING = {
  
  errorLowOperatorBalance: {
    message: 'Operator balance below minimum',
    cause: 'Operator wallet has insufficient SOL for fees',
    solution: `
      1. Check current balance:
         curl http://localhost:3001/api/health/operator
      
      2. Fund operator wallet:
         solana transfer <operator-address> 1.0
      
      3. Wait a few seconds and retry
    `,
  },
  
  errorInsufficientBalance: {
    message: 'Not enough balance in Privacy Cash pool',
    cause: 'Pool balance is lower than withdrawal amount',
    solution: `
      1. Deposit more SOL via frontend
      2. Wait for deposit to confirm
      3. Try withdrawal again
    `,
  },
  
  errorRpcConnection: {
    message: 'Cannot connect to RPC endpoint',
    cause: 'RPC endpoint is down or invalid',
    solution: `
      1. Check RPC_URL in environment
      2. Test connectivity:
         curl http://localhost:3001/api/health/rpc
      
      3. If failing, switch to backup RPC:
         - Helius: https://api.helius-rpc.com/?api-key=...
         - QuickNode: https://your-endpoint.quiknode.pro/
         - Alchemy: https://solana-mainnet.g.alchemy.com/v2/...
    `,
  },
  
  errorTransactionNotConfirmed: {
    message: 'Withdrawal confirmed by SDK but not on-chain',
    cause: 'Network congestion or RPC lag',
    solution: `
      1. Wait a few seconds
      2. Check transaction on Solscan
      3. If still unconfirmed after 1 minute, contact support
    `,
  },
};

// ============================================================================
// PART 9: MONITORING & ALERTS
// ============================================================================

const MONITORING = {
  
  recommended: [
    {
      metric: 'Operator balance',
      endpoint: 'GET /api/health/operator',
      frequency: '5 minutes',
      alert: 'If balance < 0.1 SOL',
    },
    {
      metric: 'Health status',
      endpoint: 'GET /api/health',
      frequency: '1 minute',
      alert: 'If status != "healthy"',
    },
    {
      metric: 'RPC latency',
      endpoint: 'GET /api/health/rpc',
      frequency: '5 minutes',
      alert: 'If latency > 5000ms',
    },
    {
      metric: 'Withdrawal success rate',
      endpoint: 'Query transaction table in database',
      frequency: 'Daily',
      alert: 'If success rate < 95%',
    },
  ],
  
  example_monitoring_script: `
    // Monitor operator balance every 5 minutes
    setInterval(async () => {
      const response = await fetch('http://localhost:3001/api/health/operator');
      const data = await response.json();
      
      if (!data.balance.hasSufficientBalance) {
        console.error('⚠️ ALERT: Operator balance low:', data.balance.sol);
        // Send email/Slack notification
      }
    }, 5 * 60 * 1000);
  `,
};

// ============================================================================
// PART 10: PRODUCTION NOTES
// ============================================================================

const PRODUCTION_NOTES = `
  Before going live with ShadowPay:
  
  1. TEST THOROUGHLY
     - Create 10+ test links
     - Claim each one with different addresses
     - Monitor operator balance
     - Verify all transactions on Solscan
  
  2. SECURITY
     - Never log OPERATOR_SECRET_KEY
     - Use environment variables for secrets
     - Enable HTTPS in production
     - Set CORS properly for your domain
     - Rate limit the API endpoints
  
  3. MONITORING
     - Set up health check alerts
     - Monitor operator balance daily
     - Log all withdrawals
     - Track failure rates
  
  4. OPERATIONS
     - Keep operator balance > 0.5 SOL
     - Top up weekly or based on volume
     - Archive old transaction logs
     - Regular backups of database
  
  5. SUPPORT
     - Document operator wallet address
     - Keep emergency recovery keys safe
     - Have backup RPC endpoints ready
     - Monitor Solana network status
`;

export {
  ENVIRONMENT_SETUP,
  API_ENDPOINTS,
  SERVICES,
  WITHDRAWAL_FLOW,
  FEE_STRUCTURE,
  OPERATOR_REQUIREMENTS,
  DEPLOYMENT_CHECKLIST,
  TROUBLESHOOTING,
  MONITORING,
  PRODUCTION_NOTES,
};
