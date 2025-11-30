-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable: Add new columns with default values
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrate existing brands: Set all existing brands to ACTIVE with onboardingCompleted = true
UPDATE "brands" SET 
  "status" = 'ACTIVE', 
  "onboardingCompleted" = true, 
  "onboardingStep" = 3,
  "lastActivityAt" = "updatedAt"
WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "brands_workspaceId_status_idx" ON "brands"("workspaceId", "status");

