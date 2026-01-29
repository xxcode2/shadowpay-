-- Add encryption fields for non-custodial UTXO private key storage
-- This enables multi-wallet claiming by decrypting with link password

ALTER TABLE "PaymentLink" ADD COLUMN "encryptedUtxoPrivateKey" TEXT;
ALTER TABLE "PaymentLink" ADD COLUMN "encryptionIv" TEXT;
ALTER TABLE "PaymentLink" ADD COLUMN "encryptionSalt" TEXT;

-- Create indexes for encryption key lookups
CREATE INDEX idx_payment_link_encrypted_key ON "PaymentLink"("encryptedUtxoPrivateKey");
