/**
 * X OAuth State Management with PKCE
 * 
 * Encodes/decodes OAuth state using base64url to securely pass
 * brandId, workspaceId, userId, and codeVerifier through the OAuth flow.
 * Includes PKCE code_verifier and code_challenge generation.
 */

import crypto from 'crypto';
import { logger } from '../../../lib/logger.js';

export interface XOAuthState {
  brandId: string;
  workspaceId: string;
  userId: string;
  codeVerifier: string;
  locale?: string; // Optional locale for redirect URL
}

/**
 * Generate a random code_verifier for PKCE
 * Returns a base64url-encoded random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (256 bits) and encode as base64url
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate code_challenge from code_verifier using S256 method
 * SHA256 hash of code_verifier, then base64url encode
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash.toString('base64url');
}

/**
 * Encode OAuth state payload into base64url string
 */
export function encodeXState(payload: XOAuthState): string {
  try {
    const json = JSON.stringify(payload);
    return Buffer.from(json, 'utf8').toString('base64url');
  } catch (error) {
    logger.error({ error, payload }, 'Failed to encode X OAuth state');
    throw new Error('Failed to encode OAuth state');
  }
}

/**
 * Decode base64url OAuth state string
 */
export function decodeXState(token: string): XOAuthState {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const decoded = JSON.parse(json) as XOAuthState;
    
    // Validate required fields
    if (!decoded.brandId || !decoded.workspaceId || !decoded.userId || !decoded.codeVerifier) {
      throw new Error('Invalid OAuth state: missing required fields');
    }
    
    return decoded;
  } catch (error) {
    logger.error({ error }, 'Failed to decode X OAuth state');
    throw new Error('Invalid OAuth state');
  }
}
