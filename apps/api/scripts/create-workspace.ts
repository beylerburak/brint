import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmimp62su0000brm0kjjuqifz';

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    console.error(`❌ User with ID ${userId} not found`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email}`);

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.name || user.email}'s Workspace`,
      slug: `workspace-${Date.now()}`,
      isActive: true,
    },
  });

  console.log(`✅ Created workspace: ${workspace.name} (${workspace.id})`);

  // Create subscription with ENTERPRISE plan
  const subscription = await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });

  console.log(`✅ Created ENTERPRISE subscription for workspace`);

  // Add user as OWNER
  const member = await prisma.workspaceMember.create({
    data: {
      userId: userId,
      workspaceId: workspace.id,
      role: 'OWNER',
      joinedAt: new Date(),
      status: 'active',
    },
  });

  console.log(`✅ Added user as OWNER to workspace`);

  console.log('\n🎉 Workspace setup completed!');
  console.log('─────────────────────────────────');
  console.log(`Workspace ID: ${workspace.id}`);
  console.log(`Workspace Name: ${workspace.name}`);
  console.log(`Workspace Slug: ${workspace.slug}`);
  console.log(`Plan: ${subscription.plan}`);
  console.log(`Member Role: ${member.role}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
