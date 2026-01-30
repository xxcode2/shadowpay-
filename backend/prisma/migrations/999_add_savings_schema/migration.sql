-- CreateTable for Saving
CREATE TABLE "savings" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "totalDeposited" BIGINT NOT NULL DEFAULT 0,
    "totalWithdrawn" BIGINT NOT NULL DEFAULT 0,
    "currentBalance" BIGINT NOT NULL DEFAULT 0,
    "assetType" TEXT NOT NULL DEFAULT 'SOL',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Saving
CREATE UNIQUE INDEX "savings_walletAddress_key" ON "savings"("walletAddress");

-- CreateTable for SavingTransaction
CREATE TABLE "saving_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" BIGINT NOT NULL,
    "assetType" TEXT NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "transactionHash" TEXT,
    "memo" TEXT,
    "savingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saving_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for SavingTransaction
CREATE INDEX "saving_transactions_savingId_idx" ON "saving_transactions"("savingId");

-- CreateTable for AutoDeposit
CREATE TABLE "auto_deposits" (
    "id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "assetType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastExecutedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureMsg" TEXT,
    "savingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for AutoDeposit
CREATE INDEX "auto_deposits_savingId_idx" ON "auto_deposits"("savingId");

-- CreateTable for SavingGoal
CREATE TABLE "saving_goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" BIGINT NOT NULL,
    "deadline" TIMESTAMP(3),
    "currentAmount" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "emoji" TEXT NOT NULL DEFAULT '🎯',
    "color" TEXT NOT NULL DEFAULT 'blue',
    "savingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saving_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for SavingGoal
CREATE INDEX "saving_goals_savingId_idx" ON "saving_goals"("savingId");

-- Add foreign keys
ALTER TABLE "saving_transactions" ADD CONSTRAINT "saving_transactions_savingId_fkey" FOREIGN KEY ("savingId") REFERENCES "savings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_deposits" ADD CONSTRAINT "auto_deposits_savingId_fkey" FOREIGN KEY ("savingId") REFERENCES "savings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_savingId_fkey" FOREIGN KEY ("savingId") REFERENCES "savings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
