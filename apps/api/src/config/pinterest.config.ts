/**
 * Pinterest Configuration
 * 
 * Centralized configuration for Pinterest OAuth integration.
 */

import { env } from './env.js';

export const pinterestConfig = {
  clientId: process.env.PINTEREST_APP_ID || '',
  clientSecret: process.env.PINTEREST_APP_SECRET || '',
  redirectUri: process.env.PINTEREST_REDIRECT_URI || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

/**
 * Validate Pinterest config on module load
 */
if (!pinterestConfig.clientId || !pinterestConfig.clientSecret || !pinterestConfig.redirectUri) {
  console.warn('⚠️  Pinterest OAuth config is incomplete. Pinterest integration may not work.');
}
