/**
 * LinkedIn Configuration
 * 
 * Centralized configuration for LinkedIn OAuth integration.
 */

import { env } from './env.js';

export const linkedinConfig = {
  clientId: process.env.LINKEDIN_CLIENT_ID || '',
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

/**
 * Validate LinkedIn config on module load
 */
if (!linkedinConfig.clientId || !linkedinConfig.clientSecret || !linkedinConfig.redirectUri) {
  console.warn('⚠️  LinkedIn OAuth config is incomplete. LinkedIn integration may not work.');
}
