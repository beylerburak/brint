/**
 * Social Account Module Exports
 */

// Service functions
export {
  listByBrand,
  getById,
  getByPlatformAccount,
  createOrUpdateFromOAuth,
  markAsExpired,
  disconnect,
  updateAvatar,
  updateTokens,
  getActiveAccountsForBrand,
  deleteSocialAccount,
  type SocialAccountDto,
  type SocialAccountWithTokens,
  type CreateOrUpdateFromOAuthInput,
} from './social-account.service.js';

// Publisher functions
export {
  publishToAccount,
  publishToAllBrandAccounts,
  publishToBrandPlatformAccount,
  type PublishContent,
  type PublishResult,
} from './social-account.publisher.js';

// Routes registration
export { registerSocialAccountRoutes } from './social-account.routes.js';
