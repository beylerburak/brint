/**
 * Token Service Unit Tests (TS-16)
 * 
 * Basic tests to verify token service sign/verify functions work correctly.
 * 
 * To run manually:
 *   tsx src/core/auth/token.service.spec.ts
 */

import jwt from 'jsonwebtoken';
import { tokenService, AccessTokenPayload, RefreshTokenPayload } from './token.service.js';
import { authConfig } from '../../config/index.js';

async function runTests() {
  console.log('🧪 Starting TS-16 Token Service Tests...\n');

  try {
    // Test 1: Access Token - Sign and Verify
    console.log('Test 1: Access Token - Sign and Verify');
    const accessPayload = { sub: 'user_123', wid: 'ws_456' };
    const accessToken = tokenService.signAccessToken(accessPayload);
    console.log('✅ Access token signed');

    const verifiedAccess = tokenService.verifyAccessToken(accessToken);
    
    // Verify payload matches
    if (verifiedAccess.sub !== accessPayload.sub) {
      throw new Error(`Expected sub: ${accessPayload.sub}, got: ${verifiedAccess.sub}`);
    }
    if (verifiedAccess.wid !== accessPayload.wid) {
      throw new Error(`Expected wid: ${accessPayload.wid}, got: ${verifiedAccess.wid}`);
    }
    if (verifiedAccess.type !== 'access') {
      throw new Error(`Expected type: 'access', got: ${verifiedAccess.type}`);
    }
    console.log('✅ Access token verified - payload matches');

    // Test 2: Access Token - Expiry from config
    console.log('\nTest 2: Access Token - Expiry from config');
    const decodedAccess = jwt.decode(accessToken) as AccessTokenPayload & { exp: number; iat: number };
    if (!decodedAccess || !decodedAccess.exp) {
      throw new Error('Failed to decode access token');
    }

    const now = Math.floor(Date.now() / 1000);
    const expectedExp = now + (authConfig.accessToken.expiresInMinutes * 60);
    const tolerance = 60; // ±60 seconds

    if (Math.abs(decodedAccess.exp - expectedExp) > tolerance) {
      throw new Error(
        `Access token expiry mismatch. Expected: ~${expectedExp}, got: ${decodedAccess.exp}, diff: ${Math.abs(decodedAccess.exp - expectedExp)}s`
      );
    }
    console.log(`✅ Access token expiry correct (~${authConfig.accessToken.expiresInMinutes} minutes)`);

    // Test 3: Refresh Token - Sign and Verify
    console.log('\nTest 3: Refresh Token - Sign and Verify');
    const refreshPayload = { sub: 'user_123', tid: 'refresh_token_id_789' };
    const refreshToken = tokenService.signRefreshToken(refreshPayload);
    console.log('✅ Refresh token signed');

    const verifiedRefresh = tokenService.verifyRefreshToken(refreshToken);
    
    // Verify payload matches
    if (verifiedRefresh.sub !== refreshPayload.sub) {
      throw new Error(`Expected sub: ${refreshPayload.sub}, got: ${verifiedRefresh.sub}`);
    }
    if (verifiedRefresh.tid !== refreshPayload.tid) {
      throw new Error(`Expected tid: ${refreshPayload.tid}, got: ${verifiedRefresh.tid}`);
    }
    if (verifiedRefresh.type !== 'refresh') {
      throw new Error(`Expected type: 'refresh', got: ${verifiedRefresh.type}`);
    }
    console.log('✅ Refresh token verified - payload matches');

    // Test 4: Refresh Token - Expiry from config
    console.log('\nTest 4: Refresh Token - Expiry from config');
    const decodedRefresh = jwt.decode(refreshToken) as RefreshTokenPayload & { exp: number; iat: number };
    if (!decodedRefresh || !decodedRefresh.exp) {
      throw new Error('Failed to decode refresh token');
    }

    const expectedRefreshExp = now + (authConfig.refreshToken.expiresInDays * 24 * 60 * 60);
    const refreshTolerance = 60; // ±60 seconds

    if (Math.abs(decodedRefresh.exp - expectedRefreshExp) > refreshTolerance) {
      throw new Error(
        `Refresh token expiry mismatch. Expected: ~${expectedRefreshExp}, got: ${decodedRefresh.exp}, diff: ${Math.abs(decodedRefresh.exp - expectedRefreshExp)}s`
      );
    }
    console.log(`✅ Refresh token expiry correct (~${authConfig.refreshToken.expiresInDays} days)`);

    // Test 5: Invalid token handling
    console.log('\nTest 5: Invalid token handling');
    try {
      tokenService.verifyAccessToken('invalid.token.here');
      throw new Error('Should have thrown an error for invalid token');
    } catch (error: any) {
      if (error.message && error.message.includes('Invalid token')) {
        console.log('✅ Invalid token correctly rejected');
      } else {
        throw error;
      }
    }

    // Test 6: Wrong token type (access vs refresh)
    console.log('\nTest 6: Token type validation');
    try {
      // Try to verify access token with refresh token secret (should fail)
      const wrongToken = jwt.sign(
        { sub: 'user_123', type: 'access' },
        authConfig.refreshToken.secret,
        { issuer: authConfig.issuer }
      );
      tokenService.verifyAccessToken(wrongToken);
      throw new Error('Should have thrown an error for wrong secret');
    } catch (error: any) {
      if (error.message && (error.message.includes('Invalid token') || error.message.includes('invalid signature'))) {
        console.log('✅ Wrong secret correctly rejected');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All TS-16 token service tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('token.service.spec.ts');

if (isMainModule) {
  runTests()
    .then(() => {
      console.log('\n✅ TS-16 token service tests: OK');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ TS-16 token service tests: FAILED');
      console.error(error);
      process.exitCode = 1;
      process.exit(1);
    });
}

export { runTests };

