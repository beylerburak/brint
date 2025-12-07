import { PrismaClient } from '@prisma/client';

import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. User
  // Require environment variables for seed credentials - no hardcoded defaults to prevent security issues
  const seedEmail = process.env.SEED_USER_EMAIL;
  const seedPassword = process.env.SEED_USER_PASSWORD;

  if (!seedEmail || !seedPassword) {
    throw new Error(
      'SEED_USER_EMAIL and SEED_USER_PASSWORD environment variables are required. ' +
      'Never use hardcoded credentials in seed files. Set these variables before running seed.'
    );
  }
  
  const hashedPassword = await bcrypt.hash(seedPassword, 10);
  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    update: {},
    create: {
      email: seedEmail,
      name: 'Test User',
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });
  console.log('✅ User created:', user.email);

  // 2. Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      slug: 'demo-workspace',
      name: 'Demo Workspace',
      ownerUserId: user.id,
    },
  });
  console.log('✅ Workspace:', workspace.slug);

  // 3. WorkspaceMember with OWNER role
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER', // Using WorkspaceRole enum
    },
  });
  console.log('✅ WorkspaceMember created with OWNER role');

  // 4. Default Task Statuses
  const existingStatuses = await prisma.taskStatus.findMany({
    where: { workspaceId: workspace.id },
  });

  if (existingStatuses.length === 0) {
    const defaultStatuses = [
      {
        workspaceId: workspace.id,
        brandId: null,
        group: 'TODO' as const,
        key: 'NOT_STARTED',
        label: 'Not Started',
        color: '#94a3b8',
        isDefault: true,
        isSystem: true,
        sortOrder: 0,
      },
      {
        workspaceId: workspace.id,
        brandId: null,
        group: 'IN_PROGRESS' as const,
        key: 'IN_PROGRESS',
        label: 'In Progress',
        color: '#3b82f6',
        isDefault: true,
        isSystem: true,
        sortOrder: 0,
      },
      {
        workspaceId: workspace.id,
        brandId: null,
        group: 'DONE' as const,
        key: 'COMPLETED',
        label: 'Completed',
        color: '#22c55e',
        isDefault: true,
        isSystem: true,
        sortOrder: 0,
      },
    ];

    await prisma.taskStatus.createMany({
      data: defaultStatuses,
    });
    console.log('✅ Default task statuses created (NOT_STARTED, IN_PROGRESS, COMPLETED)');
  } else {
    console.log('ℹ️  Task statuses already exist, skipping');
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

