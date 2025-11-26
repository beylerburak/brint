import { randomUUID } from 'crypto';
import { redis } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';
import { magicLinkService } from './magic-link.service.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';

async function main() {
  console.log('Running TS-21.9 magic-link.service tests...\n');

  // Test 1 – createMagicLink → Redis kaydı
  console.log('Test 1: createMagicLink → Redis record');
  const timestamp = Date.now();
  const email = `magic+${timestamp}@example.com`;

  const createResult = await magicLinkService.createMagicLink({ email });

  if (!createResult.token) {
    throw new Error('Test 1 failed: Token was not generated');
  }

  if (createResult.payload.email !== email.toLowerCase()) {
    throw new Error(
      `Test 1 failed: Payload email mismatch. Expected ${email.toLowerCase()}, got ${createResult.payload.email}`
    );
  }

  // Check Redis
  const redisKey = `magic_link:${createResult.token}`;
  const rawPayload = await redis.get(redisKey);

  if (!rawPayload) {
    throw new Error('Test 1 failed: Redis key was not found');
  }

  const payload = JSON.parse(rawPayload) as {
    email: string;
    createdAt: string;
    redirectTo?: string | null;
  };

  if (payload.email !== email.toLowerCase()) {
    throw new Error(
      `Test 1 failed: Redis payload email mismatch. Expected ${email.toLowerCase()}, got ${payload.email}`
    );
  }

  if (!payload.createdAt) {
    throw new Error('Test 1 failed: Redis payload createdAt is missing');
  }

  // Check TTL (should be > 0)
  const ttl = await redis.ttl(redisKey);
  if (ttl <= 0) {
    throw new Error(`Test 1 failed: Redis TTL should be > 0, got ${ttl}`);
  }

  console.log('✓ Test 1 passed\n');

  // Test 2 – consumeMagicLink → user + workspace + tokens
  console.log('Test 2: consumeMagicLink → user + workspace + tokens');
  const testEmail = `magic-test-${timestamp}@example.com`;
  const testToken = randomUUID();

  // Manually create Redis entry
  const testPayload = {
    email: testEmail,
    createdAt: new Date().toISOString(),
    redirectTo: null,
  };
  await redis.setex(`magic_link:${testToken}`, 900, JSON.stringify(testPayload));

  const consumeResult = await magicLinkService.consumeMagicLink(testToken, {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  });

  // Verify user was created
  if (!consumeResult.user) {
    throw new Error('Test 2 failed: User was not created');
  }

  if (consumeResult.user.email !== testEmail) {
    throw new Error(
      `Test 2 failed: User email mismatch. Expected ${testEmail}, got ${consumeResult.user.email}`
    );
  }

  if (!consumeResult.user.emailVerified) {
    throw new Error('Test 2 failed: User emailVerified should be set');
  }

  // Verify workspace was created
  if (!consumeResult.workspace) {
    throw new Error('Test 2 failed: Workspace was not created');
  }

  // Verify workspace membership
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: consumeResult.user.id,
      workspaceId: consumeResult.workspace.id,
    },
  });

  if (!membership) {
    throw new Error('Test 2 failed: Workspace membership was not created');
  }

  if (membership.role !== 'owner') {
    throw new Error(`Test 2 failed: Workspace role should be 'owner', got ${membership.role}`);
  }

  // Verify tokens
  if (!consumeResult.accessToken) {
    throw new Error('Test 2 failed: Access token was not generated');
  }

  if (!consumeResult.refreshToken) {
    throw new Error('Test 2 failed: Refresh token was not generated');
  }

  // Verify access token
  const accessPayload = tokenService.verifyAccessToken(consumeResult.accessToken);
  if (accessPayload.sub !== consumeResult.user.id) {
    throw new Error('Test 2 failed: Access token sub mismatch');
  }

  if (accessPayload.wid !== consumeResult.workspace.id) {
    throw new Error('Test 2 failed: Access token wid mismatch');
  }

  if (accessPayload.type !== 'access') {
    throw new Error('Test 2 failed: Access token type mismatch');
  }

  // Verify refresh token
  const refreshPayload = tokenService.verifyRefreshToken(consumeResult.refreshToken);
  if (refreshPayload.sub !== consumeResult.user.id) {
    throw new Error('Test 2 failed: Refresh token sub mismatch');
  }

  if (refreshPayload.type !== 'refresh') {
    throw new Error('Test 2 failed: Refresh token type mismatch');
  }

  // Verify session was created
  const session = await prisma.session.findUnique({
    where: { id: refreshPayload.tid },
  });

  if (!session) {
    throw new Error('Test 2 failed: Session was not created');
  }

  if (session.userId !== consumeResult.user.id) {
    throw new Error('Test 2 failed: Session userId mismatch');
  }

  if (session.userAgent !== 'test-agent') {
    throw new Error(`Test 2 failed: Session userAgent mismatch. Expected 'test-agent', got ${session.userAgent}`);
  }

  if (session.ipAddress !== '127.0.0.1') {
    throw new Error(`Test 2 failed: Session ipAddress mismatch. Expected '127.0.0.1', got ${session.ipAddress}`);
  }

  // Verify Redis key was deleted (one-time use)
  const deletedKey = await redis.get(`magic_link:${testToken}`);
  if (deletedKey) {
    throw new Error('Test 2 failed: Redis key should be deleted after consumption');
  }

  console.log('✓ Test 2 passed\n');

  // Test 3 – invalid / expired token
  console.log('Test 3: Invalid / expired token');
  const invalidToken = randomUUID();

  try {
    await magicLinkService.consumeMagicLink(invalidToken, {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    throw new Error('Test 3 failed: Should have thrown an error for invalid token');
  } catch (error: any) {
    if (error?.name !== 'MagicLinkError' && !error?.message?.includes('Magic link')) {
      throw new Error(
        `Test 3 failed: Expected MagicLinkError, got ${error?.name || 'unknown error'}: ${error?.message}`
      );
    }
  }

  console.log('✓ Test 3 passed\n');

  // Cleanup
  console.log('Cleaning up test data...');
  // Clean up first test's Redis key if it still exists
  await redis.del(redisKey).catch(() => {
    // Ignore if already deleted
  });

  // Clean up second test's user and workspace
  if (consumeResult.user) {
    await prisma.session.deleteMany({
      where: { userId: consumeResult.user.id },
    });
    await prisma.workspaceMember.deleteMany({
      where: { userId: consumeResult.user.id },
    });
    await prisma.workspace.delete({
      where: { id: consumeResult.workspace.id },
    }).catch(() => {
      // Ignore if already deleted
    });
    await prisma.user.delete({
      where: { id: consumeResult.user.id },
    });
  }
  console.log('✓ Cleanup complete\n');

  console.log('TS-21.9 magic-link.service tests: OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

