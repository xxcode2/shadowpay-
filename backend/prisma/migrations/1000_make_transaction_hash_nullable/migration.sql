-- Make transactionHash nullable on transactions table
-- This allows creating transactions without a hash initially
-- Hash will be populated when the transaction is confirmed

-- First, try to drop any unique constraint that might exist
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_transactionHash_key" CASCADE;

-- Make the column nullable
ALTER TABLE "transactions" ALTER COLUMN "transactionHash" DROP NOT NULL;

-- Convert existing empty strings to NULL
