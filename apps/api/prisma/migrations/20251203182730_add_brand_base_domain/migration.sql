-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "brands" 
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "primaryLocale" TEXT,
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "logoMediaId" TEXT,
  DROP COLUMN "isActive";

-- DropIndex (old unique constraint)
DROP INDEX IF EXISTS "brands_workspaceId_slug_key";

-- CreateIndex (new unique constraint on slug only)
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_workspaceId_idx" ON "brands"("workspaceId");

