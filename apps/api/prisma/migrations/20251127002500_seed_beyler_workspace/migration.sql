-- Seed Beyler Interactive workspace, membership, and subscription

-- Create workspace
INSERT INTO "workspaces" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES ('ws_beyler', 'Beyler Interactive', 'beyler', true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

-- Add owner membership for user cmigmuicp0000dklfgn2x7fp2
INSERT INTO "workspace_members" ("id", "userId", "workspaceId", "role", "status", "createdAt", "joinedAt")
VALUES (
  'wm_beyler_owner',
  'cmigmuicp0000dklfgn2x7fp2',
  'ws_beyler',
  'OWNER',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT ("userId", "workspaceId") DO UPDATE SET
  "role" = 'OWNER',
  "status" = 'active',
  "joinedAt" = NOW(),
  "createdAt" = "workspace_members"."createdAt";

-- Attach subscription (Enterprise plan, active, period now → +30 days)
INSERT INTO "Subscription" ("id", "workspaceId", "plan", "status", "periodStart", "periodEnd", "cancelAt", "createdAt", "updatedAt")
VALUES (
  'sub_beyler',
  'ws_beyler',
  'ENTERPRISE',
  'ACTIVE',
  NOW(),
  NOW() + INTERVAL '30 days',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("workspaceId") DO UPDATE SET
  "plan" = EXCLUDED."plan",
  "status" = EXCLUDED."status",
  "periodStart" = EXCLUDED."periodStart",
  "periodEnd" = EXCLUDED."periodEnd",
  "cancelAt" = EXCLUDED."cancelAt",
  "updatedAt" = NOW();
