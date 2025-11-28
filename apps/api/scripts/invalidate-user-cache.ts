import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first, then apps/api/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { prisma } from '../src/lib/prisma.js';
import { permissionService } from '../src/core/auth/permission.service.js';
import { redis } from '../src/lib/redis.js';

/**
 * Invalidates permission cache for a specific user across all their workspaces.
 * Usage: pnpm exec tsx scripts/invalidate-user-cache.ts <userId>
 */

const USER_ID = process.argv[2] || 'cmigmuicp0000dklfgn2x7fp2';

async function main() {
  console.log(`🔄 Invalidating permission cache for user: ${USER_ID}\n`);

  // Find all workspaces where this user is a member
  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: {
      userId: USER_ID,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (workspaceMembers.length === 0) {
    console.log('⚠️  User not found in any workspace.');
    return;
  }

  console.log(`📋 Found ${workspaceMembers.length} workspace(s):`);
  workspaceMembers.forEach((wm) => {
    const workspaceInfo = wm.workspace
      ? `${wm.workspace.name} (${wm.workspace.slug})`
      : wm.workspaceId;
    console.log(`   - ${workspaceInfo} (role: ${wm.role})`);
  });
  console.log();

  // Invalidate cache for each workspace
  let invalidatedCount = 0;
  for (const wm of workspaceMembers) {
    const workspaceInfo = wm.workspace
      ? `${wm.workspace.name} (${wm.workspace.slug})`
      : wm.workspaceId;
    
    console.log(`🔄 Invalidating cache for workspace: ${workspaceInfo}`);
    
    try {
      await permissionService.invalidateUserWorkspace(USER_ID, wm.workspaceId);
      invalidatedCount++;
      console.log(`   ✅ Cache invalidated\n`);
    } catch (error) {
      console.error(`   ❌ Failed to invalidate cache:`, error);
    }
  }

  console.log(`🎉 Cache invalidation completed!`);
  console.log(`   - Total workspaces: ${workspaceMembers.length}`);
  console.log(`   - Invalidated: ${invalidatedCount}`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to invalidate cache', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

