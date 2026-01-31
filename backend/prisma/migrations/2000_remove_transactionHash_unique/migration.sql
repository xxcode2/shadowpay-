-- Remove UNIQUE constraint from transactionHash
-- This allows pending markers and multiple transactions

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_transactionHash_key";
ALTER TABLE "transactions" ALTER COLUMN "transactionHash" DROP NOT NULL;
