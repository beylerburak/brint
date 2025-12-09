/**
 * X (Twitter) Configuration
 * 
 * Centralized configuration for X OAuth 2.0 PKCE integration.
 */

export const xConfig = {
  clientId: process.env.X_CLIENT_ID || '',
  clientSecret: process.env.X_CLIENT_SECRET || '',
  redirectUri: process.env.X_REDIRECT_URI || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

/**
 * Validate X config on module load
 */
if (!xConfig.clientId || !xConfig.clientSecret || !xConfig.redirectUri) {
  console.warn('⚠️  X OAuth config is incomplete. X integration may not work.');
}
