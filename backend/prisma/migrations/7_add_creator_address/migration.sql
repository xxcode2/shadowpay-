-- Add creatorAddress field to PaymentLink table for history tracking
ALTER TABLE "PaymentLink" ADD COLUMN "creatorAddress" TEXT;

-- Create index for efficient history queries
CREATE INDEX idx_payment_link_creator ON "PaymentLink"("creatorAddress");
