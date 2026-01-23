-- Ensure depositTx is nullable (fix for payment link creation)
-- This must be applied before any link creations with null depositTx
ALTER TABLE "payment_links" ALTER COLUMN "depositTx" DROP NOT NULL;
