-- Make transactionHash nullable on transactions table
-- This allows creating transactions without a hash initially
-- Hash will be populated when the transaction is confirmed

ALTER TABLE "transactions" ALTER COLUMN "transactionHash" DROP NOT NULL;

-- Also ensure any existing empty strings are converted to NULL
UPDATE "transactions" SET "transactionHash" = NULL WHERE "transactionHash" = '';
