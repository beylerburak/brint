-- Seed Beyler Interactive workspace, membership, and subscription
-- Note: This seed uses only columns available at this migration point

-- Create workspace (without isActive - added later in db_fix_missing_fields_v2)
INSERT INTO "workspaces" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('ws_beyler', 'Beyler Interactive', 'beyler', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updatedAt" = NOW();

-- Add owner membership for user cmigmuicp0000dklfgn2x7fp2
-- Note: status and joinedAt are added later in db_fix_missing_fields_v2
INSERT INTO "workspace_members" ("id", "userId", "workspaceId", "role", "createdAt")
VALUES (
  'wm_beyler_owner',
  'cmigmuicp0000dklfgn2x7fp2',
  'ws_beyler',
  'OWNER',
  NOW()
)
ON CONFLICT ("userId", "workspaceId") DO UPDATE SET
  "role" = 'OWNER',
  "createdAt" = "workspace_members"."createdAt";
