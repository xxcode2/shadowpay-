-- Remove commitment field (BREAKING: violates architecture)
ALTER TABLE "payment_links" DROP CONSTRAINT IF EXISTS "payment_links_commitment_key";
ALTER TABLE "payment_links" DROP COLUMN IF EXISTS "commitment";
