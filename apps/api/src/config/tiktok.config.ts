/**
 * TikTok Configuration
 * 
 * Centralized configuration for TikTok OAuth integration.
 */

export const tiktokConfig = {
  clientKey: process.env.TIKTOK_CLIENT_KEY || '',
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  redirectUri: process.env.TIKTOK_REDIRECT_URI || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

/**
 * Validate TikTok config on module load
 */
if (!tiktokConfig.clientKey || !tiktokConfig.clientSecret || !tiktokConfig.redirectUri) {
  console.warn('⚠️  TikTok OAuth config is incomplete. TikTok integration may not work.');
}
