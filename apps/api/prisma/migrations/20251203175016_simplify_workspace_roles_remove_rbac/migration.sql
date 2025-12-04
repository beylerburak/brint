/*
  Warnings:

  - You are about to drop the `permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roles` table. If the table is not empty, all the data it contains will be lost.
  - The `role` column on the `workspace_members` table would be dropped and recreated. This will lead to data loss.

*/
-- DropForeignKey (clean up role_permissions)
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permissionId_fkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_roleId_fkey";

-- DropForeignKey (clean up roles)
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_workspaceId_fkey";

-- Drop RBAC tables
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "roles";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- AlterTable: Save existing role data temporarily
ALTER TABLE "workspace_members" ADD COLUMN "role_temp" TEXT;
UPDATE "workspace_members" SET "role_temp" = "role";

-- AlterTable: Drop and recreate role column as enum
ALTER TABLE "workspace_members" DROP COLUMN "role";
ALTER TABLE "workspace_members" ADD COLUMN "role" "WorkspaceRole" NOT NULL DEFAULT 'EDITOR';

-- AlterTable: Migrate old string roles to new enum
-- Map 'owner' -> OWNER, 'admin' -> ADMIN, 'member' or 'editor' -> EDITOR, anything else -> VIEWER
UPDATE "workspace_members" 
SET "role" = CASE 
  WHEN LOWER("role_temp") = 'owner' THEN 'OWNER'::"WorkspaceRole"
  WHEN LOWER("role_temp") = 'admin' THEN 'ADMIN'::"WorkspaceRole"
  WHEN LOWER("role_temp") IN ('member', 'editor') THEN 'EDITOR'::"WorkspaceRole"
  ELSE 'VIEWER'::"WorkspaceRole"
END;

-- Drop temporary column
ALTER TABLE "workspace_members" DROP COLUMN "role_temp";

