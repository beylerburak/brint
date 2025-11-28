import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first, then apps/api/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { prisma } from '../src/lib/prisma.js';
import { getAllPermissionKeys } from '../src/core/auth/permissions.registry.js';

/**
 * Updates all workspace-owner roles to include all current permissions.
 * This ensures that existing owner roles have the new workspace:settings.manage permission.
 */

async function main() {
  console.log('🔄 Starting owner permissions update...\n');

  // Get all permission keys from registry (includes new workspace:settings.manage)
  const allPermissionKeys = getAllPermissionKeys();
  console.log(`📋 Found ${allPermissionKeys.length} permissions in registry:`);
  allPermissionKeys.forEach((key) => console.log(`   - ${key}`));
  console.log();

  // Ensure all permissions exist in database
  console.log('📋 Ensuring all permissions exist in database...');
  const permissions = await Promise.all(
    allPermissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: {
          key,
          description: `Permission: ${key}`,
        },
      })
    )
  );
  console.log(`✅ ${permissions.length} permissions ensured\n`);

  // Find all workspace-owner roles
  console.log('📋 Finding all workspace-owner roles...');
  const ownerRoles = await prisma.role.findMany({
    where: {
      key: 'workspace-owner',
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
  console.log(`✅ Found ${ownerRoles.length} workspace-owner roles\n`);

  if (ownerRoles.length === 0) {
    console.log('⚠️  No workspace-owner roles found. Nothing to update.');
    return;
  }

  // Update each owner role to have all permissions
  let updatedCount = 0;
  for (const role of ownerRoles) {
    const workspaceInfo = role.workspace
      ? `${role.workspace.name} (${role.workspace.slug})`
      : 'Global';
    
    console.log(`📋 Updating owner role for workspace: ${workspaceInfo}`);

    // Get current permissions for this role
    const currentRolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    const currentPermissionKeys = new Set(
      currentRolePermissions.map((rp) => rp.permission.key)
    );

    // Find missing permissions
    const missingPermissions = permissions.filter(
      (p) => !currentPermissionKeys.has(p.key)
    );

    if (missingPermissions.length === 0) {
      console.log(`   ✅ Already has all permissions (${currentPermissionKeys.size})`);
      continue;
    }

    // Add missing permissions
    console.log(`   ➕ Adding ${missingPermissions.length} missing permission(s):`);
    missingPermissions.forEach((p) => console.log(`      - ${p.key}`));

    await prisma.rolePermission.createMany({
      data: missingPermissions.map((perm) => ({
        roleId: role.id,
        permissionId: perm.id,
      })),
      skipDuplicates: true,
    });

    updatedCount++;
    console.log(`   ✅ Updated successfully\n`);
  }

  console.log(`🎉 Update completed!`);
  console.log(`   - Total owner roles: ${ownerRoles.length}`);
  console.log(`   - Updated roles: ${updatedCount}`);
  console.log(`   - Already up-to-date: ${ownerRoles.length - updatedCount}`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to update owner permissions', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

