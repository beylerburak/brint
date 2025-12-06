/**
 * Seed default task statuses for an existing workspace
 * 
 * Usage: pnpm tsx scripts/seed-workspace-statuses.ts <workspaceId>
 */

import { ensureDefaultStatusesForWorkspace } from '../src/modules/task/task-status.service.js';

const workspaceId = process.argv[2];

if (!workspaceId) {
  console.error('Usage: pnpm tsx scripts/seed-workspace-statuses.ts <workspaceId>');
  process.exit(1);
}

async function main() {
  try {
    console.log(`Seeding default statuses for workspace: ${workspaceId}`);
    await ensureDefaultStatusesForWorkspace(workspaceId);
    console.log('✅ Default statuses seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed default statuses:', error);
    process.exit(1);
  }
}

main();

