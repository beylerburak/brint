/**
 * Test status fetch for a workspace
 */

import { TaskStatusRepository } from '../src/modules/task/task-status.repository.js';
import { getStatusesForScope } from '../src/modules/task/task-status.service.js';

const workspaceId = process.argv[2] || 'cmipww3ri0001db0j2iws16a6';
const brandId = process.argv[3] || undefined;

async function main() {
  try {
    console.log(`Testing status fetch for workspace: ${workspaceId}, brandId: ${brandId || 'null'}`);
    
    const repository = new TaskStatusRepository();
    const rawStatuses = await repository.findStatusesForWorkspaceAndBrand({
      workspaceId,
      brandId: brandId || undefined,
    });
    
    console.log('\n📊 Raw statuses from repository:');
    console.log(JSON.stringify(rawStatuses.map(s => ({
      id: s.id,
      label: s.label,
      group: s.group,
      brandId: s.brandId,
      isDefault: s.isDefault,
    })), null, 2));
    
    console.log('\n📦 Grouped statuses from service:');
    const grouped = await getStatusesForScope(
      { userId: 'test', workspaceId },
      { brandId: brandId || undefined }
    );
    
    console.log('TODO:', grouped.TODO.length, grouped.TODO.map(s => s.label));
    console.log('IN_PROGRESS:', grouped.IN_PROGRESS.length, grouped.IN_PROGRESS.map(s => s.label));
    console.log('DONE:', grouped.DONE.length, grouped.DONE.map(s => s.label));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

