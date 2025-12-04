import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. User
  const hashedPassword = await bcrypt.hash('qqwqdz65', 10);
  const user = await prisma.user.upsert({
    where: { email: 'burak@beyler.com.tr' },
    update: {},
    create: {
      email: 'burak@beyler.com.tr',
      name: 'Burak Beyler',
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });
  console.log('✅ User:', user.email, '(password: qqwqdz65)');

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

