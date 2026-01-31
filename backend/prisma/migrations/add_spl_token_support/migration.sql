-- AddColumn to PaymentLink
ALTER TABLE "payment_links" ADD COLUMN "tokenMint" TEXT;
ALTER TABLE "payment_links" ADD COLUMN "tokenName" TEXT;

-- AddColumn to Transaction
ALTER TABLE "transactions" ADD COLUMN "tokenMint" TEXT;
ALTER TABLE "transactions" ADD COLUMN "tokenName" TEXT;
