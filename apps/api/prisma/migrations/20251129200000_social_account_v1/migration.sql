-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK_PAGE', 'INSTAGRAM_BUSINESS', 'INSTAGRAM_BASIC', 'YOUTUBE_CHANNEL', 'TIKTOK_BUSINESS', 'PINTEREST_PROFILE', 'X_ACCOUNT', 'LINKEDIN_PAGE');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'REMOVED');

-- DropIndex (old unique constraint)
DROP INDEX IF EXISTS "social_accounts_brandId_provider_externalId_key";

-- Drop old columns if they exist (from previous simple schema)
ALTER TABLE "social_accounts" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "social_accounts" DROP COLUMN IF EXISTS "handle";

-- Add new columns
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "platform" "SocialPlatform";
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "profileUrl" TEXT;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "status" "SocialAccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "avatarMediaId" TEXT;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "credentialsEncrypted" TEXT;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "platformData" JSONB;

-- For existing records, set platform to FACEBOOK_PAGE as default (can be updated later)
UPDATE "social_accounts" SET "platform" = 'FACEBOOK_PAGE' WHERE "platform" IS NULL;
UPDATE "social_accounts" SET "credentialsEncrypted" = '' WHERE "credentialsEncrypted" IS NULL;

-- Make platform NOT NULL after setting defaults
ALTER TABLE "social_accounts" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE "social_accounts" ALTER COLUMN "credentialsEncrypted" SET NOT NULL;

-- CreateIndex: unique constraint on workspaceId + platform + externalId
CREATE UNIQUE INDEX "social_accounts_workspaceId_platform_externalId_key" ON "social_accounts"("workspaceId", "platform", "externalId");

-- CreateIndex: index on platform + externalId
CREATE INDEX "social_accounts_platform_externalId_idx" ON "social_accounts"("platform", "externalId");

