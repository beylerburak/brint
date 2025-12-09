/**
 * TikTok OAuth State Management
 * 
 * Encodes/decodes OAuth state using base64url to securely pass
 * brandId, workspaceId, and userId through the OAuth flow.
 */

import { logger } from '../../../lib/logger.js';

export interface TikTokOAuthState {
  brandId: string;
  workspaceId: string;
  userId: string;
  locale?: string; // Optional locale for redirect URL
}

/**
 * Encode OAuth state payload into base64url string
 */
export function encodeTikTokState(payload: TikTokOAuthState): string {
  try {
    const json = JSON.stringify(payload);
    return Buffer.from(json, 'utf8').toString('base64url');
  } catch (error) {
    logger.error({ error, payload }, 'Failed to encode TikTok OAuth state');
    throw new Error('Failed to encode OAuth state');
  }
}

/**
 * Decode base64url OAuth state string
 */
export function decodeTikTokState(token: string): TikTokOAuthState {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const decoded = JSON.parse(json) as TikTokOAuthState;
    
    // Validate required fields
    if (!decoded.brandId || !decoded.workspaceId || !decoded.userId) {
      throw new Error('Invalid OAuth state: missing required fields');
    }
    
    return decoded;
  } catch (error) {
    logger.error({ error }, 'Failed to decode TikTok OAuth state');
    throw new Error('Invalid OAuth state');
  }
}
