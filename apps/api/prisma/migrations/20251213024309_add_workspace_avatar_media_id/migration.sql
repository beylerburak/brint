-- Add avatarMediaId to Workspace table
-- Migration: add_workspace_avatar_media_id

-- Add avatarMediaId column
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "avatarMediaId" TEXT;

-- Add foreign key constraint
ALTER TABLE "workspaces" 
  ADD CONSTRAINT "workspaces_avatarMediaId_fkey" 
  FOREIGN KEY ("avatarMediaId") 
  REFERENCES "media"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Add relation index for performance
CREATE INDEX IF NOT EXISTS "workspaces_avatarMediaId_idx" ON "workspaces"("avatarMediaId");

-- Note: avatarUrl column will be removed in a future migration after data migration
-- For now, we keep both fields for backward compatibility
