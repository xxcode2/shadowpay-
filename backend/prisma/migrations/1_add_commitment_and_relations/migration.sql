-- Add commitment field to PaymentLink
ALTER TABLE "payment_links" ADD COLUMN "commitment" TEXT NOT NULL UNIQUE;

-- Add foreign key constraint from Transaction to PaymentLink
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove UNIQUE constraint from transactionHash (allow retries)
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_transactionHash_key";

-- Add index on linkId for query optimization
CREATE INDEX "transactions_linkId_idx" ON "transactions"("linkId");
