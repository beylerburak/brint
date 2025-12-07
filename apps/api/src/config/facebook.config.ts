/**
 * Facebook/Meta Configuration
 * 
 * Centralized configuration for Facebook Graph API integration.
 */

import { env } from './env.js';

export const facebookConfig = {
  appId: process.env.FACEBOOK_APP_ID || '',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',
  redirectUri: process.env.FACEBOOK_REDIRECT_URI || '',
  graphVersion: process.env.GRAPH_API_VERSION || 'v24.0',
  stateSecret: process.env.FACEBOOK_STATE_SECRET || 'change-me-facebook-state-secret-min-32-chars',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

/**
 * Validate Facebook config on module load
 */
if (!facebookConfig.appId || !facebookConfig.appSecret || !facebookConfig.redirectUri) {
  console.warn('⚠️  Facebook OAuth config is incomplete. Facebook/Instagram integration may not work.');
}
