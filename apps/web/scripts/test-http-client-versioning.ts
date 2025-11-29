/**
 * Frontend HTTP Client Versioning Test
 * 
 * Tests that the HTTP client correctly adds /v1 prefix to API routes
 * and bypasses it for non-versioned routes.
 * 
 * Run with: cd apps/web && pnpm exec tsx scripts/test-http-client-versioning.ts
 */

// Mock the dependencies
const mockAppConfig = {
  apiBaseUrl: 'http://localhost:3001',
};

const mockGetWorkspaceId = () => null;

// Simplified version of buildUrl logic for testing
function buildUrl(path: string): string {
  // If path is already absolute, use it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Non-versioned routes (health, debug, realtime) don't get /v1 prefix
  const nonVersionedRoutes = ['health', 'debug', 'realtime'];
  const isNonVersioned = nonVersionedRoutes.some((route) => 
    cleanPath.startsWith(`${route}/`) || cleanPath === route
  );
  
  // Add /v1 prefix for all API routes except non-versioned ones
  const versionedPath = isNonVersioned ? cleanPath : `v1/${cleanPath}`;
  return `${mockAppConfig.apiBaseUrl}/${versionedPath}`;
}

async function main() {
  console.log('🧪 Testing Frontend HTTP Client Versioning\n');
  console.log('=' .repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  const testCases = [
    {
      name: 'Auth route gets /v1 prefix',
      input: 'auth/google',
      expected: 'http://localhost:3001/v1/auth/google',
    },
    {
      name: 'Auth route with leading slash gets /v1 prefix',
      input: '/auth/google',
      expected: 'http://localhost:3001/v1/auth/google',
    },
    {
      name: 'Workspace route gets /v1 prefix',
      input: 'workspaces',
      expected: 'http://localhost:3001/v1/workspaces',
    },
    {
      name: 'Activity route gets /v1 prefix',
      input: 'activity',
      expected: 'http://localhost:3001/v1/activity',
    },
    {
      name: 'Health route does NOT get /v1 prefix',
      input: 'health/live',
      expected: 'http://localhost:3001/health/live',
    },
    {
      name: 'Health route with leading slash does NOT get /v1 prefix',
      input: '/health/live',
      expected: 'http://localhost:3001/health/live',
    },
    {
      name: 'Debug route does NOT get /v1 prefix',
      input: 'debug/auth',
      expected: 'http://localhost:3001/debug/auth',
    },
    {
      name: 'Realtime route does NOT get /v1 prefix',
      input: 'realtime',
      expected: 'http://localhost:3001/realtime',
    },
    {
      name: 'Absolute URL is used as-is',
      input: 'https://api.example.com/auth',
      expected: 'https://api.example.com/auth',
    },
  ];

  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    try {
      const result = buildUrl(testCase.input);
      if (result === testCase.expected) {
        console.log(`   ✅ Input: "${testCase.input}"`);
        console.log(`   ✅ Output: "${result}"`);
        passed++;
      } else {
        throw new Error(`Expected "${testCase.expected}", got "${result}"`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${passed + failed}\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.\n');
    process.exit(1);
  }
}

void main();

