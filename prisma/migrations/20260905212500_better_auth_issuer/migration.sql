ALTER TABLE "accounts" ADD COLUMN "issuer" TEXT NOT NULL DEFAULT 'local:credential';
ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP DEFAULT;
CREATE UNIQUE INDEX "accounts_issuer_accountId_key" ON "accounts"("issuer", "accountId");
