-- Make depositTx nullable (only set after actual deposit)
ALTER TABLE "payment_links" ALTER COLUMN "depositTx" DROP NOT NULL;
