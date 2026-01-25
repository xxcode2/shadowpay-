-- Add lamports column to payment_links (source of truth for on-chain amount)
ALTER TABLE "payment_links" ADD COLUMN "lamports" BIGINT;

-- Add lamports column to transactions (replace amount float)
ALTER TABLE "transactions" ADD COLUMN "lamports" BIGINT;
