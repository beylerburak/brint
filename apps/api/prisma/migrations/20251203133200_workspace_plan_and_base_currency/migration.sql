/*
  Warnings:

  - Added the required column `ownerUserId` to the `workspaces` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'AGENCY');

-- AlterTable: Add new columns with defaults first (except ownerUserId)
ALTER TABLE "workspaces" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "baseCurrency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'tr-TR',
ADD COLUMN     "plan" "WorkspacePlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul';

-- Add ownerUserId column as nullable first
ALTER TABLE "workspaces" ADD COLUMN "ownerUserId" TEXT;

-- Update existing workspaces: set ownerUserId to the first 'owner' workspace member
-- If no owner exists, use the first member of the workspace
UPDATE "workspaces" w
SET "ownerUserId" = COALESCE(
  (SELECT wm."userId" FROM "workspace_members" wm WHERE wm."workspaceId" = w.id AND wm.role = 'owner' LIMIT 1),
  (SELECT wm."userId" FROM "workspace_members" wm WHERE wm."workspaceId" = w.id LIMIT 1)
);

-- Now make ownerUserId NOT NULL
ALTER TABLE "workspaces" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
