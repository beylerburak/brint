/**
 * Migration Script: Update existing tasks to use default Backlog status
 * 
 * This script updates all tasks that don't have a statusId (after schema change)
 * to use the default "Backlog" status.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting task status migration...');

  // Get the default "Not Started" status
  const notStartedStatus = await prisma.taskStatus.findFirst({
    where: {
      slug: 'not-started',
      isDefault: true,
    },
  });

  if (!notStartedStatus) {
    console.error('❌ Default "Not Started" status not found. Please run seed first.');
    process.exit(1);
  }

  console.log(`✅ Found Not Started status: ${notStartedStatus.id}`);

  // Update all tasks without a statusId
  const result = await prisma.task.updateMany({
    where: {
      statusId: null,
    },
    data: {
      statusId: notStartedStatus.id,
    },
  });

  console.log(`✅ Updated ${result.count} tasks to Not Started status`);
  console.log('🎉 Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

