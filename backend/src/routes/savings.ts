/**
 * 💰 SHADOWPAY SAVINGS API
 *
 * Routes for:
 * - Get/create savings account
 * - Deposit to Privacy Cash (record only)
 * - Withdraw/Send from Privacy Cash (record only)
 * - Auto-deposit management
 * - Savings goals
 * - Profile/dashboard
 */

import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import { PublicKey } from '@solana/web3.js'
import { getPrivacyCashClient, executeDeposit, executeWithdrawal, queryPrivateBalance, lamportsToSol } from '../services/privacyCash.js'

const router = Router()
const db = prisma as any  // Type assertion for Prisma models

/**
 * GET /api/savings/status
 * Check if savings API is working
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'Savings API is responding',
    timestamp: new Date().toISOString()
  })
})

/**
 * POST /api/savings/init
 * Initialize or get savings account for wallet
 */
router.post('/init', async (req: Request<{}, {}, any>, res: Response) => {
  try {
    const { walletAddress, assetType = 'SOL' } = req.body

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' })
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    // Check database is available
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not set, cannot initialize savings account')
      return res.status(503).json({ 
        error: 'Database service unavailable',
        message: 'DATABASE_URL environment variable not configured'
      })
    }

    // Check database connection
    if (!db || !db.saving) {
      console.error('❌ Database client not available')
      return res.status(503).json({ error: 'Database service unavailable' })
    }

    // Try to create or find account
    try {
      let saving = await db.saving.findUnique({
        where: { walletAddress },
      })

      if (!saving) {
        saving = await db.saving.create({
          data: {
            walletAddress,
            assetType,
          },
        })
        console.log(`✅ Created savings account for ${walletAddress}`)
      }

      res.json({
        id: saving.id,
        walletAddress: saving.walletAddress,
        assetType: saving.assetType,
        totalDeposited: saving.totalDeposited.toString(),
        totalWithdrawn: saving.totalWithdrawn.toString(),
        currentBalance: saving.currentBalance.toString(),
        createdAt: saving.createdAt,
      })
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message?.split('\n')[0] || dbError.message)
      
      // Check various database error codes
      const errorMsg = dbError.message || ''
      
      if (errorMsg.includes("Can't reach database")) {
        return res.status(503).json({ 
          error: 'Database connection failed',
          message: 'Cannot connect to database server'
        })
      }
      
      if (dbError.code === 'P1000') {
        return res.status(503).json({ 
          error: 'Database authentication failed',
          message: 'Invalid database credentials'
        })
      }
      
      if (dbError.code === 'P2021') {
        return res.status(503).json({ 
          error: 'Database schema incomplete',
          message: 'Savings tables not found. Run migrations.'
        })
      }
      
      // For any other database error, return 503
      return res.status(503).json({ 
        error: 'Database error',
        message: 'Database operation failed'
      })
    }
  } catch (error: any) {
    console.error('❌ Init savings error:', error.message?.split('\n')[0] || error.message || error)
    res.status(500).json({ error: error.message || 'Failed to initialize savings account' })
  }
})

/**
 * GET /api/savings/:walletAddress
 * Get savings profile
 */
router.get('/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params

    const saving = await db.saving.findUnique({
      where: { walletAddress },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        autoDeposits: true,
        goals: true,
      },
    })

    if (!saving) {
      return res.status(404).json({ error: 'Savings account not found' })
    }

    res.json({
      id: saving.id,
      walletAddress: saving.walletAddress,
      assetType: saving.assetType,
      totalDeposited: saving.totalDeposited.toString(),
      totalWithdrawn: saving.totalWithdrawn.toString(),
      currentBalance: saving.currentBalance.toString(),
      lastSyncedAt: saving.lastSyncedAt,
      transactions: saving.transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        status: tx.status,
        amount: tx.amount.toString(),
        assetType: tx.assetType,
        fromAddress: tx.fromAddress,
        toAddress: tx.toAddress,
        transactionHash: tx.transactionHash,
        memo: tx.memo,
        createdAt: tx.createdAt,
      })),
      autoDeposits: saving.autoDeposits,
      goals: saving.goals.map((goal: any) => ({
        id: goal.id,
        name: goal.name,
        description: goal.description,
        targetAmount: goal.targetAmount.toString(),
        currentAmount: goal.currentAmount.toString(),
        deadline: goal.deadline,
        status: goal.status,
        progress: goal.targetAmount > 0n
          ? Math.round(Number(goal.currentAmount) / Number(goal.targetAmount) * 100)
          : 0,
        emoji: goal.emoji,
        color: goal.color,
      })),
      createdAt: saving.createdAt,
      updatedAt: saving.updatedAt,
    })
  } catch (error: any) {
    console.error('❌ Get savings error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/execute-deposit
 * Execute deposit with PrivacyCash SDK on backend
 * This is what frontend should call (not try to use SDK directly)
 */
router.post('/:walletAddress/execute-deposit', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { amount, assetType = 'SOL' } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    // Check database connection
    if (!db || !db.saving) {
      console.error('❌ Database connection failed')
      return res.status(503).json({ error: 'Database service unavailable' })
    }

    // Step 1: Initialize PC client with operator keypair
    let pc
    try {
      pc = getPrivacyCashClient()
    } catch (err: any) {
      console.error('❌ Failed to init PrivacyCash:', err.message)
      return res.status(500).json({ error: 'Backend PrivacyCash not configured' })
    }

    // Step 2: Execute deposit with PrivacyCash SDK
    let depositResult
    try {
      console.log(`💸 Executing deposit via PrivacyCash: ${amount} lamports`)
      depositResult = await executeDeposit(pc, amount)
      console.log(`✅ Deposit completed: ${depositResult.tx}`)
    } catch (err: any) {
      console.error('❌ Deposit execution failed:', err.message)
      return res.status(500).json({ error: err.message })
    }

    // Step 3: Find or create savings account
    let saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      console.log(`📌 Auto-creating savings account for ${walletAddress}`)
      saving = await db.saving.create({
        data: {
          walletAddress,
          assetType,
        },
      })
    }

    // Step 4: Record transaction in database
    const transaction = await db.savingTransaction.create({
      data: {
        savingId: saving.id,
        type: 'deposit',
        status: 'confirmed',
        amount: BigInt(amount),
        assetType,
        fromAddress: walletAddress,
        transactionHash: depositResult.tx,
        memo: 'Deposit to Privacy Cash',
      },
    })

    // Step 5: Update balance
    await db.saving.update({
      where: { id: saving.id },
      data: {
        totalDeposited: { increment: BigInt(amount) },
        currentBalance: { increment: BigInt(amount) },
        lastSyncedAt: new Date(),
      },
    })

    console.log(`✅ Deposit recorded: ${walletAddress} +${amount} (${lamportsToSol(amount)} SOL)`)

    res.json({
      transactionId: transaction.id,
      status: 'confirmed',
      transactionHash: depositResult.tx,
      amount: amount.toString(),
      amountSOL: depositResult.sol.toString(),
      assetType,
    })
  } catch (error: any) {
    console.error('❌ Execute deposit error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/deposit
 * Record a deposit transaction
 */
router.post('/:walletAddress/deposit', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { amount, assetType, transactionHash, memo } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    // Find or create savings account
    let saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      console.log(`📌 Auto-creating savings account for ${walletAddress}`)
      saving = await db.saving.create({
        data: {
          walletAddress,
          assetType: assetType || 'SOL',
        },
      })
    }

    // Create transaction record
    const transaction = await db.savingTransaction.create({
      data: {
        savingId: saving.id,
        type: 'deposit',
        status: transactionHash ? 'confirmed' : 'pending',
        amount: BigInt(amount),
        assetType: assetType || saving.assetType,
        fromAddress: walletAddress,
        transactionHash,
        memo,
      },
    })

    // Update saving balance
    await db.saving.update({
      where: { id: saving.id },
      data: {
        totalDeposited: { increment: BigInt(amount) },
        currentBalance: { increment: BigInt(amount) },
        lastSyncedAt: new Date(),
      },
    })

    console.log(`✅ Deposit recorded: ${walletAddress} +${amount} ${assetType}`)

    res.json({
      transactionId: transaction.id,
      status: 'recorded',
      amount: amount.toString(),
      assetType: transaction.assetType,
    })
  } catch (error: any) {
    console.error('❌ Deposit record error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/send
 * Send from savings to another address
 */
router.post('/:walletAddress/send', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { toAddress, amount, assetType, transactionHash, memo } = req.body

    if (!toAddress) {
      return res.status(400).json({ error: 'Recipient address required' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    // Validate recipient address
    try {
      new PublicKey(toAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid recipient address' })
    }

    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      // Auto-create savings account for send
      console.log(`📌 Auto-creating savings account for ${walletAddress}`)
      await db.saving.create({
        data: {
          walletAddress,
          assetType: assetType || 'SOL',
        },
      })
      
      // Still fail because no balance
      return res.status(400).json({ error: 'No savings account - deposit first' })
    }

    if (saving.currentBalance < BigInt(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    // Create transaction record
    const transaction = await db.savingTransaction.create({
      data: {
        savingId: saving.id,
        type: 'send',
        status: transactionHash ? 'confirmed' : 'pending',
        amount: BigInt(amount),
        assetType: assetType || saving.assetType,
        fromAddress: walletAddress,
        toAddress,
        transactionHash,
        memo,
      },
    })

    // Update balance
    await db.saving.update({
      where: { id: saving.id },
      data: {
        totalWithdrawn: { increment: BigInt(amount) },
        currentBalance: { decrement: BigInt(amount) },
        lastSyncedAt: new Date(),
      },
    })

    console.log(`✅ Send recorded: ${walletAddress} → ${toAddress} (${amount} ${assetType})`)

    res.json({
      transactionId: transaction.id,
      status: 'recorded',
      to: toAddress,
      amount: amount.toString(),
      assetType: transaction.assetType,
    })
  } catch (error: any) {
    console.error('❌ Send error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/withdraw
 * Withdraw from savings to own address
 */
router.post('/:walletAddress/withdraw', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { amount, assetType, transactionHash, memo } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      // Auto-create savings account for withdraw
      console.log(`📌 Auto-creating savings account for ${walletAddress}`)
      await db.saving.create({
        data: {
          walletAddress,
          assetType: assetType || 'SOL',
        },
      })
      
      // Still fail because no balance
      return res.status(400).json({ error: 'No savings to withdraw - deposit first' })
    }

    if (saving.currentBalance < BigInt(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    // Create transaction record
    const transaction = await db.savingTransaction.create({
      data: {
        savingId: saving.id,
        type: 'withdraw',
        status: transactionHash ? 'confirmed' : 'pending',
        amount: BigInt(amount),
        assetType: assetType || saving.assetType,
        fromAddress: walletAddress,
        toAddress: walletAddress,
        transactionHash,
        memo,
      },
    })

    // Update balance
    await db.saving.update({
      where: { id: saving.id },
      data: {
        totalWithdrawn: { increment: BigInt(amount) },
        currentBalance: { decrement: BigInt(amount) },
        lastSyncedAt: new Date(),
      },
    })

    console.log(`✅ Withdrawal recorded: ${walletAddress} -${amount} ${assetType}`)

    res.json({
      transactionId: transaction.id,
      status: 'recorded',
      amount: amount.toString(),
      assetType: transaction.assetType,
    })
  } catch (error: any) {
    console.error('❌ Withdraw error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/auto-deposit
 * Setup auto-deposit
 */
router.post('/:walletAddress/auto-deposit', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { frequency, amount, assetType, enabled = true } = req.body

    if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      return res.status(404).json({ error: 'Savings account not found' })
    }

    const autoDeposit = await db.autoDeposit.create({
      data: {
        savingId: saving.id,
        frequency,
        amount: BigInt(amount),
        assetType: assetType || saving.assetType,
        enabled,
        nextScheduledAt: calculateNextSchedule(frequency),
      },
    })

    console.log(`✅ Auto-deposit created: ${frequency} ${amount} ${assetType}`)

    res.json({
      id: autoDeposit.id,
      frequency,
      amount: autoDeposit.amount.toString(),
      assetType: autoDeposit.assetType,
      enabled,
      nextScheduledAt: autoDeposit.nextScheduledAt,
    })
  } catch (error: any) {
    console.error('❌ Auto-deposit error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/savings/:walletAddress/auto-deposit/:autoDepositId
 * Update auto-deposit
 */
router.put('/:walletAddress/auto-deposit/:autoDepositId', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { autoDepositId } = req.params
    const { frequency, amount, enabled } = req.body

    const autoDeposit = await db.autoDeposit.update({
      where: { id: autoDepositId },
      data: {
        ...(frequency && { frequency }),
        ...(amount && { amount: BigInt(amount) }),
        ...(enabled !== undefined && { enabled }),
        ...(frequency && { nextScheduledAt: calculateNextSchedule(frequency) }),
      },
    })

    res.json({
      id: autoDeposit.id,
      frequency: autoDeposit.frequency,
      amount: autoDeposit.amount.toString(),
      enabled: autoDeposit.enabled,
      nextScheduledAt: autoDeposit.nextScheduledAt,
    })
  } catch (error: any) {
    console.error('❌ Update auto-deposit error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/savings/:walletAddress/auto-deposit/:autoDepositId
 * Remove auto-deposit
 */
router.delete('/:walletAddress/auto-deposit/:autoDepositId', async (req: Request, res: Response) => {
  try {
    const { autoDepositId } = req.params

    await db.autoDeposit.delete({
      where: { id: autoDepositId },
    })

    res.json({ success: true, message: 'Auto-deposit removed' })
  } catch (error: any) {
    console.error('❌ Delete auto-deposit error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/goals
 * Create savings goal
 */
router.post('/:walletAddress/goals', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { name, description, targetAmount, deadline, emoji = '🎯', color = 'blue' } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Goal name required' })
    }

    if (!targetAmount || targetAmount <= 0) {
      return res.status(400).json({ error: 'Valid target amount required' })
    }

    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      return res.status(404).json({ error: 'Savings account not found' })
    }

    const goal = await db.savingGoal.create({
      data: {
        savingId: saving.id,
        name,
        description,
        targetAmount: BigInt(targetAmount),
        deadline: deadline ? new Date(deadline) : null,
        emoji,
        color,
      },
    })

    res.json({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      deadline: goal.deadline,
      emoji: goal.emoji,
      color: goal.color,
    })
  } catch (error: any) {
    console.error('❌ Create goal error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/savings/:walletAddress/goals/:goalId
 * Update goal progress (called when balance syncs)
 */
router.put('/:walletAddress/goals/:goalId', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { goalId } = req.params
    const { currentAmount, status } = req.body

    const goal = await db.savingGoal.update({
      where: { id: goalId },
      data: {
        ...(currentAmount !== undefined && { currentAmount: BigInt(currentAmount) }),
        ...(status && { status }),
      },
    })

    const progress = goal.targetAmount > 0n
      ? Math.round(Number(goal.currentAmount) / Number(goal.targetAmount) * 100)
      : 0

    res.json({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      progress,
      status: goal.status,
    })
  } catch (error: any) {
    console.error('❌ Update goal error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/savings/:walletAddress/goals/:goalId
 * Delete goal
 */
router.delete('/:walletAddress/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params

    await db.savingGoal.delete({
      where: { id: goalId },
    })

    res.json({ success: true, message: 'Goal deleted' })
  } catch (error: any) {
    console.error('❌ Delete goal error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Helper: Calculate next schedule date
 */
function calculateNextSchedule(frequency: string): Date {
  const now = new Date()

  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1)
      break
    case 'weekly':
      now.setDate(now.getDate() + 7)
      break
    case 'monthly':
      now.setMonth(now.getMonth() + 1)
      break
  }

  return now
}

/**
 * POST /api/savings/:walletAddress/execute-send
 * Execute send/withdraw from Privacy Cash to another address
 * Backend handles PrivacyCash SDK operations
 */
router.post('/:walletAddress/execute-send', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { toAddress, amount, assetType = 'SOL', memo } = req.body

    if (!toAddress || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters - need toAddress and amount' })
    }

    // Validate addresses
    try {
      new PublicKey(walletAddress)
      new PublicKey(toAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet or recipient address' })
    }

    // Check savings account exists and has balance
    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving || saving.currentBalance < BigInt(amount)) {
      return res.status(400).json({ error: 'Insufficient balance in savings' })
    }

    // Step 1: Initialize PC client with operator keypair
    let pc
    try {
      pc = getPrivacyCashClient()
    } catch (err: any) {
      return res.status(500).json({ error: 'Backend PrivacyCash not configured' })
    }

    // Step 2: Execute send/withdrawal with PrivacyCash SDK
    let sendResult
    try {
      console.log(`📤 Executing send via PrivacyCash: ${amount} lamports to ${toAddress}`)
      sendResult = await executeWithdrawal(pc, amount, toAddress)
      console.log(`✅ Send completed: ${sendResult.tx}`)
    } catch (err: any) {
      console.error('❌ Send execution failed:', err.message)
      return res.status(500).json({ error: err.message })
    }

    // Step 3: Record transaction in database
    const transaction = await db.savingTransaction.create({
      data: {
        savingId: saving.id,
        type: 'send',
        status: 'confirmed',
        amount: BigInt(amount),
        assetType,
        fromAddress: walletAddress,
        toAddress,
        transactionHash: sendResult.tx,
        memo: memo || 'Send from Privacy Cash',
      },
    })

    // Step 4: Update balance
    await db.saving.update({
      where: { id: saving.id },
      data: {
        totalWithdrawn: { increment: BigInt(amount) },
        currentBalance: { decrement: BigInt(amount) },
        lastSyncedAt: new Date(),
      },
    })

    console.log(`✅ Send recorded: ${walletAddress} -> ${toAddress} ${amount}`)

    res.json({
      transactionId: transaction.id,
      status: 'confirmed',
      transactionHash: sendResult.tx,
      amount: amount.toString(),
      amountSOL: sendResult.sol.toString(),
      assetType,
      recipient: toAddress,
    })
  } catch (error: any) {
    console.error('❌ Execute send error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/execute-withdraw
 * Execute withdraw from Privacy Cash to own wallet
 * Backend handles PrivacyCash SDK operations
 */
router.post('/:walletAddress/execute-withdraw', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { amount, assetType = 'SOL', memo } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' })
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    // Check savings account exists and has balance
    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving || saving.currentBalance < BigInt(amount)) {
      return res.status(400).json({ error: 'Insufficient balance in savings' })
    }

    // Step 1: Initialize PC client with operator keypair
    let pc
    try {
      pc = getPrivacyCashClient()
    } catch (err: any) {
      return res.status(500).json({ error: 'Backend PrivacyCash not configured' })
    }

    // Step 2: Execute withdrawal with PrivacyCash SDK
    let withdrawResult
    try {
      console.log(`⬆️ Executing withdraw via PrivacyCash: ${amount} lamports`)
      withdrawResult = await executeWithdrawal(pc, amount, walletAddress)
      console.log(`✅ Withdrawal completed: ${withdrawResult.tx}`)
    } catch (err: any) {
      console.error('❌ Withdrawal execution failed:', err.message)
      return res.status(500).json({ error: err.message })
    }

    // Step 3: Record transaction in database
    const transaction = await db.savingTransaction.create({
      data: {
        savingId: saving.id,
        type: 'withdraw',
        status: 'confirmed',
        amount: BigInt(amount),
        assetType,
        fromAddress: walletAddress,
        toAddress: walletAddress,
        transactionHash: withdrawResult.tx,
        memo: memo || 'Withdraw from Privacy Cash',
      },
    })

    // Step 4: Update balance
    await db.saving.update({
      where: { id: saving.id },
      data: {
        totalWithdrawn: { increment: BigInt(amount) },
        currentBalance: { decrement: BigInt(amount) },
        lastSyncedAt: new Date(),
      },
    })

    console.log(`✅ Withdrawal recorded: ${walletAddress} -${amount}`)

    res.json({
      transactionId: transaction.id,
      status: 'confirmed',
      transactionHash: withdrawResult.tx,
      amount: amount.toString(),
      amountSOL: withdrawResult.sol.toString(),
      assetType,
    })
  } catch (error: any) {
    console.error('❌ Execute withdraw error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/savings/:walletAddress/balance
 * Get private balance from Privacy Cash pool
 * Backend handles PrivacyCash SDK operations
 */
router.post('/:walletAddress/balance', async (req: Request<any, {}, any>, res: Response) => {
  try {
    const { walletAddress } = req.params
    const { assetType = 'SOL' } = req.body

    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    // Check savings account exists
    const saving = await db.saving.findUnique({
      where: { walletAddress },
    })

    if (!saving) {
      return res.status(404).json({ error: 'Savings account not found' })
    }

    // Step 1: Initialize PC client with operator keypair
    let pc
    try {
      pc = getPrivacyCashClient()
    } catch (err: any) {
      return res.status(500).json({ error: 'Backend PrivacyCash not configured' })
    }

    // Step 2: Query balance from Privacy Cash
    let balanceResult
    try {
      console.log(`🔍 Querying private balance for ${walletAddress}`)
      balanceResult = await queryPrivateBalance(pc)
      console.log(`   Balance: ${balanceResult.lamports} lamports`)
    } catch (err: any) {
      console.error('❌ Balance query failed:', err.message)
      return res.status(500).json({ error: err.message })
    }

    res.json({
      balance: balanceResult.lamports,
      balanceSOL: lamportsToSol(balanceResult.lamports),
      assetType,
      formatted: `${lamportsToSol(balanceResult.lamports).toFixed(4)} SOL`,
    })
  } catch (error: any) {
    console.error('❌ Get balance error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
