-- DropIndex
DROP INDEX "brands_workspaceId_updatedAt_idx";

-- DropIndex
DROP INDEX "publications_clientRequestId_key";

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
