-- AlterEnum - Add new content types for social publishing
ALTER TYPE "PublicationContentType" ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE "PublicationContentType" ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE "PublicationContentType" ADD VALUE IF NOT EXISTS 'link';

-- AlterTable - Add new fields for social publishing
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "socialAccountId" TEXT;
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "permalink" TEXT;
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "payloadJson" JSONB;
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "providerResponseJson" JSONB;
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

-- Make contentId optional (null for direct social publishing without Content)
ALTER TABLE "publications" ALTER COLUMN "contentId" DROP NOT NULL;

-- CreateIndex - Add index for socialAccountId lookups
CREATE INDEX IF NOT EXISTS "publications_socialAccountId_idx" ON "publications"("socialAccountId");

-- CreateIndex - Add index for scheduled publishing worker queries
CREATE INDEX IF NOT EXISTS "publications_status_scheduledAt_platform_idx" ON "publications"("status", "scheduledAt", "platform");

-- CreateIndex - Add unique index for clientRequestId (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "publications_clientRequestId_key" ON "publications"("clientRequestId");

-- AddForeignKey - Link to SocialAccount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'publications_socialAccountId_fkey'
  ) THEN
    ALTER TABLE "publications" ADD CONSTRAINT "publications_socialAccountId_fkey" 
    FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

