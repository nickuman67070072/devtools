-- Better Auth 1.7.3+ no longer writes issuer for credential or social accounts.
-- Keep the legacy column nullable so databases that briefly ran 1.7.0-1.7.2
-- remain readable while new sign-ups can be inserted safely.
ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP NOT NULL;
