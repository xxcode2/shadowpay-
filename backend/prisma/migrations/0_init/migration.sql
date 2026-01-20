-- CreateTable PaymentLink
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" DOUBLE PRECISION NOT NULL,
    "assetType" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedBy" TEXT,
    "depositTx" TEXT NOT NULL,
    "withdrawTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable Transaction
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DOUBLE PRECISION NOT NULL,
    "assetType" TEXT NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
