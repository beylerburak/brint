/**
 * Simple script to generate a test token for manual testing
 * Usage: tsx src/core/auth/generate-test-token.ts
 */

import { tokenService } from './token.service.js';

const userId = process.argv[2] || 'test-user-id';

const token = tokenService.signAccessToken({ sub: userId });

console.log('\n📝 Test Token Generated:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(token);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n💡 Usage:');
console.log(`curl -H "Authorization: Bearer ${token}" \\`);
console.log(`     -H "X-Workspace-Id: ws_test_123" \\`);
console.log(`     -H "X-Brand-Id: br_test_456" \\`);
console.log('     http://localhost:4000/debug/auth');
console.log('');

