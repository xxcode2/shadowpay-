/**
 * Privacy Cash Backend Integration Example
 * Complete working example of backend server operations
 */

// Example 1: Basic Server Initialization
export async function initializeBackendExample() {
  const { config, PRIVACY_CASH_CONFIG } = await import('./config.js');
  
  // Validate configuration and log setup
  if (!config.SOLANA_RPC_URL) {
    console.error('Configuration error: SOLANA_RPC_URL not set');
    process.exit(1);
  }
  
  console.log('✅ Backend initialized successfully');
  console.log(`   RPC URL: ${config.SOLANA_RPC_URL}`);
  console.log(`   Privacy Cash Program: ${PRIVACY_CASH_CONFIG.programId}`);
}

// Example 2: Handle Deposit (Frontend -> Backend Flow)
export async function handleDepositExample() {
  const { prisma } = await import('./lib/prisma.js');
  const { PRIVACY_CASH_CONFIG } = await import('./config.js');
  
  // Simulate a deposit notification from frontend
  const depositData = {
    linkId: 'link_abc123',
    txHash: 'AbCdEf...',
    amount: 0.1, // SOL
    timestamp: new Date(),
  };
  
  // Record deposit transaction
  const deposit = await prisma.transaction.create({
    data: {
      type: 'deposit',
      linkId: depositData.linkId,
      transactionHash: depositData.txHash,
      amount: depositData.amount,
      assetType: 'SOL',
      status: 'pending',
    },
  });
  
  console.log('✅ Deposit recorded:', deposit.transactionHash);
}

// Example 3: Process Withdrawal (Backend Core Operation)
export async function handleWithdrawalExample() {
  const { getPrivacyCashClient } = await import('./services/privacyCash.js');
  const { verifyDepositTransaction } = await import('./utils/privacyCashOperations.js');
  const { config } = await import('./config.js');
  const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
  
  // Get Privacy Cash client
  const pc = getPrivacyCashClient();
  
  // Withdrawal parameters
  const recipientAddress = 'Hs1X...'; // User's Solana address
  const amountSOL = 0.05; // Amount to withdraw
  const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
  
  try {
    console.log(`💰 Processing withdrawal: ${amountSOL} SOL to ${recipientAddress}`);
    
    // Execute withdrawal via Privacy Cash SDK
    const result = await pc.withdraw({
      lamports: amountLamports,
      recipientAddress: recipientAddress,
    });
    
    const { tx, amount_in_lamports, fee_in_lamports, isPartial } = result;
    
    console.log(`✅ Withdrawal executed: ${tx}`);
    console.log(`   Recipient received: ${amount_in_lamports / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Fee charged: ${fee_in_lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Verify transaction on-chain
    console.log(`🔍 Verifying transaction...`);
    const verification = await verifyDepositTransaction(tx, config.SOLANA_RPC_URL);
    
    if (verification.isConfirmed) {
      console.log(`✅ Transaction confirmed`);
    }
    
    return { success: true, tx, amount: amount_in_lamports / LAMPORTS_PER_SOL };
    
  } catch (error) {
    console.error('❌ Withdrawal failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Example 4: Monitor Operator Balance
export async function checkOperatorBalanceExample() {
  const { checkOperatorWalletBalance } = await import('./utils/privacyCashOperations.js');
  const { config, PRIVACY_CASH_CONFIG } = await import('./config.js');
  
  try {
    const balance = await checkOperatorWalletBalance(config.SOLANA_RPC_URL);
    
    console.log(`💰 Operator Balance: ${balance.balanceSOL.toFixed(4)} SOL`);
    console.log(`   Min Required: ${PRIVACY_CASH_CONFIG.operator.minBalance} SOL`);
    console.log(`   Status: ${balance.hasSufficientBalance ? '✅ OK' : '⚠️ LOW'}`);
    
    if (!balance.hasSufficientBalance) {
      console.warn(`⚠️ Operator balance below minimum. Please top up: ${PRIVACY_CASH_CONFIG.operator.minBalance} SOL`);
    }
    
    return balance;
    
  } catch (error) {
    console.error('❌ Could not check balance:', error);
  }
}

// Example 5: Get Health Status
export async function getHealthStatusExample() {
  // Call health endpoint
  const response = await fetch('http://localhost:3001/api/health');
  const health = await response.json();
  
  console.log(`\n🏥 Health Status:`);
  console.log(`   Status: ${health.status}`);
  console.log(`   Response Time: ${health.responseTimeMs}ms`);
  console.log(`\n📋 Components:`);
  console.log(`   Configuration: ${health.components.configuration.status}`);
  console.log(`   Operator: ${health.components.operator.status}`);
  console.log(`   Privacy Cash: ${health.components.privacyCash.status}`);
  
  if (health.components.configuration.errors.length > 0) {
    console.error(`   Errors: ${health.components.configuration.errors.join(', ')}`);
  }
  
  return health;
}

// Example 6: Environment Variable Setup
export function showEnvironmentSetupExample() {
  const example = `
  # Backend Privacy Cash Environment Variables
  
  # RPC Configuration
  SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
  # or use Helius/QuickNode/Alchemy RPC
  
  # Operator Keypair (4 supported formats)
  
  # Format 1: JSON array (recommended)
  OPERATOR_SECRET_KEY=[232,221,205,...,23]
  
  # Format 2: Comma-separated numbers
  OPERATOR_SECRET_KEY=232,221,205,...,23
  
  # Format 3: Base58 string
  OPERATOR_SECRET_KEY=Hs1XkAzz2Vg6...
  
  # Format 4: Solana Keypair JSON string
  OPERATOR_SECRET_KEY={"_keypair":{"publicKey":...}}
  
  # Optional: Custom Privacy Cash Program ID
  PRIVACY_CASH_PROGRAM=9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD
  
  # Server Configuration
  PORT=3001
  NODE_ENV=production
  DATABASE_URL=postgresql://...
  `;
  
  console.log(example);
}

// Example 7: Error Handling Patterns
export async function errorHandlingExample() {
  const { formatWithdrawalError } = await import('./services/privacyCash.js');
  
  try {
    // Simulate withdrawal error
    throw new Error('INSUFFICIENT_BALANCE');
  } catch (err: any) {
    // Format error for client
    const formattedError = formatWithdrawalError(err);
    
    console.error(`User-friendly error: ${formattedError.message}`);
    console.error(`Error code: ${formattedError.code}`);
    console.error(`Suggestion: ${formattedError.suggestion}`);
  }
}

// Example 8: Fee Estimation
export async function estimateFeeExample() {
  const { PRIVACY_CASH_CONFIG } = await import('./config.js');
  
  const amountSOL = 0.1;
  const baseFee = PRIVACY_CASH_CONFIG.withdrawal.baseFee;
  const protocolFee = amountSOL * PRIVACY_CASH_CONFIG.withdrawal.protocolFeePercentage;
  
  console.log(`\n💰 Fee Estimation for ${amountSOL} SOL withdrawal:`);
  console.log(`   Base Fee: ${baseFee} SOL`);
  console.log(`   Protocol Fee (0.35%): ${protocolFee.toFixed(8)} SOL`);
  console.log(`   Total Fee: ${fees.totalFee.toFixed(8)} SOL`);
  console.log(`   Net Amount Received: ${fees.netAmount.toFixed(8)} SOL`);
}

// Example 9: Link Creation Flow
export async function createLinkFlowExample() {
  const { prisma } = await import('./lib/prisma.js');
  const { PRIVACY_CASH_CONFIG } = await import('./config.js');
  
  // Create a new payment link
  const link = await prisma.paymentLink.create({
    data: {
      id: 'link_' + Date.now(),
      amount: 0.1,
      lamports: Math.floor(0.1 * 1_000_000_000),
      claimed: false,
      assetType: 'SOL',
      memo: 'Payment for services',
    },
  });
  
  // Calculate fees that sender will pay
  const fees = PRIVACY_CASH_CONFIG.withdrawal;
  const totalCost = 0.1 + fees.baseFee + (0.1 * fees.protocolFeePercentage);
  
  console.log(`✅ Link created: ${link.id}`);
  console.log(`   Amount: ${link.amount} SOL`);
  console.log(`   Sender will pay: ${totalCost.toFixed(8)} SOL total`);
  
  return link;
}

// Example 10: Transaction History Query
export async function queryTransactionHistoryExample() {
  const { prisma } = await import('./lib/prisma.js');
  
  // Get recent withdrawals
  const withdrawals = await prisma.transaction.findMany({
    where: {
      type: 'withdraw',
      status: 'confirmed',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });
  
  console.log(`\n📊 Recent Withdrawals:`);
  withdrawals.forEach((tx) => {
    console.log(`   ${tx.transactionHash.slice(0, 8)}... - ${tx.amount} SOL - ${tx.createdAt.toISOString()}`);
  });
  
  return withdrawals;
}
