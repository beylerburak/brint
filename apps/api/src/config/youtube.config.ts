/**
 * YouTube Configuration
 * 
 * Centralized configuration for YouTube OAuth integration.
 */

export const youtubeConfig = {
  clientId: process.env.YOUTUBE_CLIENT_ID || '',
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
  redirectUri: process.env.YOUTUBE_REDIRECT_URI || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

/**
 * Validate YouTube config on module load
 */
if (!youtubeConfig.clientId || !youtubeConfig.clientSecret || !youtubeConfig.redirectUri) {
  console.warn('⚠️  YouTube OAuth config is incomplete. YouTube integration may not work.');
}
