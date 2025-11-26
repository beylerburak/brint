/**
 * Unit tests for permissions.registry.ts
 * 
 * Run with: pnpm --filter @brint/api exec tsx src/core/auth/permissions.registry.spec.ts
 */

import { PERMISSIONS, PermissionKey, isPermissionKey, getAllPermissionKeys } from './permissions.registry.js';

// Test 1: Duplicate key check
function testNoDuplicateValues() {
  console.log('🧪 Test 1: Checking for duplicate permission values...');
  
  const values = Object.values(PERMISSIONS);
  const uniqueValues = new Set(values);
  
  if (values.length !== uniqueValues.size) {
    console.error('❌ FAIL: Duplicate permission values found!');
    console.error('Values:', values);
    console.error('Unique:', Array.from(uniqueValues));
    process.exit(1);
  }
  
  console.log('✅ PASS: No duplicate permission values');
}

// Test 2: Required permissions exist
function testRequiredPermissionsExist() {
  console.log('🧪 Test 2: Checking required permissions exist...');
  
  const required = [
    'workspace:settings.view',
    'workspace:members.manage',
    'studio:brand.view',
    'studio:brand.create',
    'studio:content.create',
    'studio:content.publish',
  ];
  
  const values = Object.values(PERMISSIONS);
  const missing = required.filter((req) => !values.includes(req as PermissionKey));
  
  if (missing.length > 0) {
    console.error('❌ FAIL: Missing required permissions:', missing);
    process.exit(1);
  }
  
  console.log('✅ PASS: All required permissions exist');
}

// Test 3: Type-safe usage (compile-time check)
function testTypeSafeUsage() {
  console.log('🧪 Test 3: Testing type-safe usage...');
  
  // This function should accept only PermissionKey
  function requirePermission(key: PermissionKey): void {
    // In a real scenario, this would check permissions
    console.log(`   Checking permission: ${key}`);
  }
  
  // Valid usage - should compile
  requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW);
  requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE);
  
  // Test that getAllPermissionKeys returns PermissionKey[]
  const allKeys = getAllPermissionKeys();
  allKeys.forEach((key) => {
    requirePermission(key); // Should compile without errors
  });
  
  console.log('✅ PASS: Type-safe usage works correctly');
}

// Test 4: isPermissionKey type guard
function testIsPermissionKey() {
  console.log('🧪 Test 4: Testing isPermissionKey type guard...');
  
  const validKey = PERMISSIONS.WORKSPACE_SETTINGS_VIEW;
  const invalidKey = 'invalid:permission.key';
  
  if (!isPermissionKey(validKey)) {
    console.error('❌ FAIL: Valid permission key not recognized');
    process.exit(1);
  }
  
  if (isPermissionKey(invalidKey)) {
    console.error('❌ FAIL: Invalid permission key incorrectly recognized as valid');
    process.exit(1);
  }
  
  // Test type narrowing
  const testString: string = validKey;
  if (isPermissionKey(testString)) {
    // TypeScript should narrow testString to PermissionKey here
    const _key: PermissionKey = testString; // Should compile
  }
  
  console.log('✅ PASS: isPermissionKey type guard works correctly');
}

// Test 5: PermissionKey union type coverage
function testPermissionKeyUnionType() {
  console.log('🧪 Test 5: Testing PermissionKey union type coverage...');
  
  const allKeys = getAllPermissionKeys();
  const permissionValues = Object.values(PERMISSIONS);
  
  // All keys from getAllPermissionKeys should be in PERMISSIONS
  for (const key of allKeys) {
    if (!permissionValues.includes(key)) {
      console.error(`❌ FAIL: Key ${key} from getAllPermissionKeys not in PERMISSIONS`);
      process.exit(1);
    }
  }
  
  // All PERMISSIONS values should be PermissionKey
  for (const value of permissionValues) {
    const _key: PermissionKey = value; // Should compile
  }
  
  console.log('✅ PASS: PermissionKey union type covers all permissions');
}

// Run all tests
function runTests() {
  console.log('🚀 Running permissions.registry tests...\n');
  
  try {
    testNoDuplicateValues();
    testRequiredPermissionsExist();
    testTypeSafeUsage();
    testIsPermissionKey();
    testPermissionKeyUnionType();
    
    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Type-only test: This should cause a compile error if commented out
// Uncomment the line below to verify TypeScript catches invalid permission keys
// const invalid: PermissionKey = 'invalid:permission.key'; // @ts-expect-error - This should fail at compile time

runTests();

