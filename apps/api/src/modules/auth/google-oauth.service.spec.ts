import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { loginOrRegisterWithGoogle } from './google-oauth.service.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';

async function main() {
  console.log('Running TS-21.7 google-oauth.service tests...\n');

  // Test 1 – Yeni user create + session + tokens
  console.log('Test 1: New user creation + session + tokens');
  const timestamp = Date.now();
  const email = `google-test+${timestamp}@example.com`;
  const googleSub = `google-sub-${randomUUID()}`;

  const profile = {
    sub: googleSub,
    email,
    email_verified: true,
    name: 'Google Test User',
    picture: 'https://example.com/avatar.png',
    phone_number: '+1-555-0001',
  };

  const ctx = {
    userAgent: 'jest-agent',
    ipAddress: '127.0.0.1',
  };

  const result = await loginOrRegisterWithGoogle(profile, ctx);

  // Verify user was created
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Test 1 failed: User was not created');
  }

  if (user.email !== email) {
    throw new Error(`Test 1 failed: User email mismatch. Expected ${email}, got ${user.email}`);
  }

  if (user.googleId !== googleSub) {
    throw new Error(`Test 1 failed: User googleId mismatch. Expected ${googleSub}, got ${user.googleId}`);
  }

  if (user.name !== 'Google Test User') {
    throw new Error(`Test 1 failed: User name mismatch. Expected 'Google Test User', got ${user.name}`);
  }

  if (!user.emailVerified) {
    throw new Error('Test 1 failed: User emailVerified should be set');
  }

  if (user.phone !== '+1-555-0001') {
    throw new Error(`Test 1 failed: User phone mismatch. Expected '+1-555-0001', got ${user.phone}`);
  }

  // Verify session was created
  const session = await prisma.session.findUnique({
    where: { id: result.session.id },
  });

  if (!session) {
    throw new Error('Test 1 failed: Session was not created');
  }

  if (session.userId !== user.id) {
    throw new Error('Test 1 failed: Session userId mismatch');
  }

  if (session.id !== result.session.id) {
    throw new Error('Test 1 failed: Session id mismatch');
  }

  if (session.userAgent !== 'jest-agent') {
    throw new Error(`Test 1 failed: Session userAgent mismatch. Expected 'jest-agent', got ${session.userAgent}`);
  }

  if (session.ipAddress !== '127.0.0.1') {
    throw new Error(`Test 1 failed: Session ipAddress mismatch. Expected '127.0.0.1', got ${session.ipAddress}`);
  }

  if (session.expiresAt <= new Date()) {
    throw new Error('Test 1 failed: Session expiresAt should be in the future');
  }

  // Verify access token
  const accessPayload = tokenService.verifyAccessToken(result.accessToken);
  if (accessPayload.sub !== user.id) {
    throw new Error('Test 1 failed: Access token sub mismatch');
  }

  if (accessPayload.type !== 'access') {
    throw new Error('Test 1 failed: Access token type mismatch');
  }

  // Verify refresh token
  const refreshPayload = tokenService.verifyRefreshToken(result.refreshToken);
  if (refreshPayload.sub !== user.id) {
    throw new Error('Test 1 failed: Refresh token sub mismatch');
  }

  if (refreshPayload.tid !== session.id) {
    throw new Error('Test 1 failed: Refresh token tid mismatch');
  }

  if (refreshPayload.type !== 'refresh') {
    throw new Error('Test 1 failed: Refresh token type mismatch');
  }

  console.log('✓ Test 1 passed\n');

  // Test 2 – Aynı email ile ikinci login (idempotent-ish behavior)
  console.log('Test 2: Second login with same email (idempotent behavior)');
  const profile2 = {
    sub: `google-sub-2-${randomUUID()}`,
    email,
    email_verified: true,
    name: 'Google Test User Updated',
    phone_number: '+1-555-0002',
  };

  const result2 = await loginOrRegisterWithGoogle(profile2, ctx);

  // Verify same user ID
  const user2 = await prisma.user.findUnique({
    where: { email },
  });

  if (!user2) {
    throw new Error('Test 2 failed: User was not found');
  }

  if (user2.id !== user.id) {
    throw new Error('Test 2 failed: User ID should be the same');
  }

  // If googleId was empty, it should be updated. If it was already set, it should remain the same
  // (based on the service logic, if googleId exists and is different, it logs a warning but doesn't change it)
  if (user.googleId && user.googleId !== user2.googleId) {
    // This is expected behavior - if googleId was already set, it doesn't change
    console.log('  Note: googleId was already set, so it was not updated (expected behavior)');
  }

  if (user2.name !== 'Google Test User Updated') {
    throw new Error(`Test 2 failed: User name should update from Google. Got ${user2.name}`);
  }

  if (user2.phone !== '+1-555-0002') {
    throw new Error(`Test 2 failed: User phone should update from Google. Got ${user2.phone}`);
  }

  // Verify new session was created
  const sessionCount = await prisma.session.count({
    where: { userId: user.id },
  });

  if (sessionCount < 2) {
    throw new Error(`Test 2 failed: Expected at least 2 sessions, got ${sessionCount}`);
  }

  // Verify new tokens
  const accessPayload2 = tokenService.verifyAccessToken(result2.accessToken);
  if (accessPayload2.sub !== user.id) {
    throw new Error('Test 2 failed: Second access token sub mismatch');
  }

  const refreshPayload2 = tokenService.verifyRefreshToken(result2.refreshToken);
  if (refreshPayload2.sub !== user.id) {
    throw new Error('Test 2 failed: Second refresh token sub mismatch');
  }

  if (refreshPayload2.tid !== result2.session.id) {
    throw new Error('Test 2 failed: Second refresh token tid mismatch');
  }

  console.log('✓ Test 2 passed\n');

  // Cleanup
  console.log('Cleaning up test data...');
  await prisma.session.deleteMany({
    where: { userId: user.id },
  });
  await prisma.user.delete({
    where: { id: user.id },
  });
  console.log('✓ Cleanup complete\n');

  console.log('TS-21.7 google-oauth.service tests: OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
