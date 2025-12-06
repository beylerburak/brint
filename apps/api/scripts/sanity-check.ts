/**
 * Sanity Check Script
 * 
 * This script runs basic checks on the Task Management system.
 * Run: pnpm tsx scripts/sanity-check.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 Starting sanity checks...\n');

  // 1. Check default task statuses
  console.log('1️⃣  Checking default task statuses...');
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true },
  });

  for (const workspace of workspaces) {
    const statuses = await prisma.taskStatus.findMany({
      where: { workspaceId: workspace.id, brandId: null },
      orderBy: { group: 'asc' },
    });

    console.log(`   Workspace: ${workspace.name} (${workspace.slug})`);
    console.log(`   Statuses: ${statuses.length}`);

    const groups = {
      TODO: statuses.filter((s) => s.group === 'TODO'),
      IN_PROGRESS: statuses.filter((s) => s.group === 'IN_PROGRESS'),
      DONE: statuses.filter((s) => s.group === 'DONE'),
    };

    if (groups.TODO.length === 0 || groups.IN_PROGRESS.length === 0 || groups.DONE.length === 0) {
      console.log(`   ❌ Missing default statuses!`);
      console.log(`      - TODO: ${groups.TODO.length}`);
      console.log(`      - IN_PROGRESS: ${groups.IN_PROGRESS.length}`);
      console.log(`      - DONE: ${groups.DONE.length}`);
    } else {
      console.log(`   ✅ All groups have statuses`);
      console.log(`      - TODO: ${groups.TODO.map((s) => s.label).join(', ')}`);
      console.log(`      - IN_PROGRESS: ${groups.IN_PROGRESS.map((s) => s.label).join(', ')}`);
      console.log(`      - DONE: ${groups.DONE.map((s) => s.label).join(', ')}`);
    }

    // Check default status
    for (const [groupName, groupStatuses] of Object.entries(groups)) {
      const defaultStatus = groupStatuses.find((s) => s.isDefault);
      if (!defaultStatus && groupStatuses.length > 0) {
        console.log(`   ⚠️  No default status for ${groupName}`);
      }
    }

    console.log('');
  }

  // 2. Check system status protection
  console.log('2️⃣  Checking system status properties...');
  const systemStatuses = await prisma.taskStatus.findMany({
    where: { isSystem: true },
  });

  console.log(`   Found ${systemStatuses.length} system statuses`);
  const systemKeys = systemStatuses.map((s) => s.key).join(', ');
  console.log(`   Keys: ${systemKeys}`);

  if (systemStatuses.length > 0) {
    console.log(`   ✅ System statuses exist`);
  } else {
    console.log(`   ❌ No system statuses found!`);
  }

  console.log('');

  // 3. Check task-status relationships
  console.log('3️⃣  Checking task-status relationships...');
  const tasks = await prisma.task.findMany({
    where: { deletedAt: null },
    include: {
      status: true,
    },
    take: 5,
  });

  if (tasks.length > 0) {
    console.log(`   Found ${tasks.length} tasks (showing first 5)`);
    for (const task of tasks) {
      console.log(`   - ${task.title}: ${task.status.label} (${task.status.group})`);
    }
    console.log(`   ✅ Tasks have valid status references`);
  } else {
    console.log(`   ℹ️  No tasks found (this is OK for a new system)`);
  }

  console.log('');

  // 4. Check default status for each group
  console.log('4️⃣  Checking default status for each group...');
  for (const workspace of workspaces) {
    const groups: Array<'TODO' | 'IN_PROGRESS' | 'DONE'> = ['TODO', 'IN_PROGRESS', 'DONE'];

    for (const group of groups) {
      const defaultStatus = await prisma.taskStatus.findFirst({
        where: {
          workspaceId: workspace.id,
          brandId: null,
          group,
          isDefault: true,
          isActive: true,
        },
      });

      if (defaultStatus) {
        console.log(`   ✅ ${workspace.slug} - ${group}: ${defaultStatus.label}`);
      } else {
        console.log(`   ❌ ${workspace.slug} - ${group}: NO DEFAULT STATUS`);
      }
    }
  }

  console.log('');

  // 5. Summary
  console.log('📊 Summary:');
  const totalStatuses = await prisma.taskStatus.count();
  const totalTasks = await prisma.task.count({ where: { deletedAt: null } });
  const totalProjects = await prisma.project.count();

  console.log(`   - Total workspaces: ${workspaces.length}`);
  console.log(`   - Total task statuses: ${totalStatuses}`);
  console.log(`   - Total tasks: ${totalTasks}`);
  console.log(`   - Total projects: ${totalProjects}`);

  console.log('\n🎉 Sanity check completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Sanity check failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

