/**
 * Facebook OAuth State Management
 * 
 * Encodes/decodes OAuth state using JWT to securely pass
 * brandId, workspaceId, and userId through the OAuth flow.
 */

import jwt from 'jsonwebtoken';
import { facebookConfig } from '../../../config/facebook.config.js';
import { logger } from '../../../lib/logger.js';

export interface FacebookOAuthState {
  brandId: string;
  workspaceId: string;
  userId: string;
  locale?: string; // Optional locale for redirect URL
}

/**
 * Encode OAuth state payload into JWT token
 */
export function encodeFacebookState(payload: FacebookOAuthState): string {
  try {
    return jwt.sign(payload, facebookConfig.stateSecret, {
      expiresIn: '10m', // 10 minutes expiry
    });
  } catch (error) {
    logger.error({ error, payload }, 'Failed to encode Facebook OAuth state');
    throw new Error('Failed to encode OAuth state');
  }
}

/**
 * Decode and verify OAuth state JWT token
 */
export function decodeFacebookState(token: string): FacebookOAuthState {
  try {
    const decoded = jwt.verify(token, facebookConfig.stateSecret) as FacebookOAuthState;
    
    // Validate required fields (locale is optional)
    if (!decoded.brandId || !decoded.workspaceId || !decoded.userId) {
      throw new Error('Invalid OAuth state: missing required fields');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn({ error }, 'Facebook OAuth state token expired');
      throw new Error('OAuth state expired. Please try again.');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn({ error }, 'Invalid Facebook OAuth state token');
      throw new Error('Invalid OAuth state');
    }
    logger.error({ error }, 'Failed to decode Facebook OAuth state');
    throw error;
  }
}
