/**
 * API Client
 * 
 * Centralized HTTP client for backend API calls
 * 
 * This file composes domain-specific API modules for backward compatibility.
 * Individual modules are in apps/web/lib/api/
 */

// Re-export types and error class for backward compatibility
export { ApiError, apiCache } from './api/http';
export type { UserProfile, MeResponse } from './api/auth';
export type { WorkspaceRole, WorkspacePlan, WorkspaceSummary, WorkspaceDetails, WorkspaceDetailsResponse } from './api/workspaces';
export type { SocialPlatform, SocialAccountStatus, SocialAccountDto } from './api/social';

// Import domain modules
import { authApi } from './api/auth';
import { workspacesApi } from './api/workspaces';
import { brandsApi } from './api/brands';
import { contentApi } from './api/content';
import { tasksApi } from './api/tasks';
import { mediaApi } from './api/media';
import { socialApi } from './api/social';
import { integrationsApi } from './api/integrations';
import { tagsApi } from './api/tags';
import { apiCache } from './api/http';

// Re-export brand types
export type {
  BrandDetailDto,
  BrandProfileDto,
  BrandContactChannelDto,
  CreateBrandContactChannelInput,
  UpdateBrandContactChannelInput,
  UpdateBrandProfileInput,
} from './brand-types';

/**
 * Unified API Client
 * 
 * Composes all domain-specific API modules into a single object
 * for backward compatibility with existing code.
 */
export const apiClient = {
  // ============================================================================
  // Auth API
  // ============================================================================
  getMe: authApi.getMe,
  clearMeCache: authApi.clearMeCache,
  updateMySettings: authApi.updateMySettings,
  register: authApi.register,
  verifyEmailCode: authApi.verifyEmailCode,
  resendVerificationCode: authApi.resendVerificationCode,
  login: authApi.login,
  logout: async () => {
    const result = await authApi.logout();
    // Clear all cache on logout
    apiCache.clearAll();
    return result;
  },
  completeOnboarding: async () => {
    const result = await authApi.completeOnboarding();
    // Clear /me cache since user data changed
    authApi.clearMeCache();
    return result;
  },

  // ============================================================================
  // Workspaces API
  // ============================================================================
  getWorkspace: workspacesApi.getWorkspace,
  listWorkspaces: workspacesApi.listWorkspaces,
  listWorkspaceMembers: workspacesApi.listWorkspaceMembers,
  updateWorkspaceMemberRole: workspacesApi.updateWorkspaceMemberRole,
  removeWorkspaceMember: workspacesApi.removeWorkspaceMember,
  inviteWorkspaceMember: workspacesApi.inviteWorkspaceMember,
  checkSlugAvailable: workspacesApi.checkSlugAvailable,
  updateWorkspace: workspacesApi.updateWorkspace,

  // ============================================================================
  // Brands API
  // ============================================================================
  getBrand: brandsApi.getBrand,
  getBrandBySlug: brandsApi.getBrandBySlug,
  clearBrandCache: brandsApi.clearBrandCache,
  listBrands: brandsApi.listBrands,
  clearBrandsCache: brandsApi.clearBrandsCache,
  updateBrand: brandsApi.updateBrand,
  updateBrandProfile: brandsApi.updateBrandProfile,
  listBrandContactChannels: brandsApi.listBrandContactChannels,
  createBrandContactChannel: brandsApi.createBrandContactChannel,
  updateBrandContactChannel: brandsApi.updateBrandContactChannel,
  deleteBrandContactChannel: brandsApi.deleteBrandContactChannel,
  reorderBrandContactChannels: brandsApi.reorderBrandContactChannels,
  getBrandOptimizationScore: brandsApi.getBrandOptimizationScore,
  refreshBrandOptimizationScore: brandsApi.refreshBrandOptimizationScore,

  // ============================================================================
  // Content API
  // ============================================================================
  createContent: contentApi.createContent,
  updateContent: contentApi.updateContent,
  getContent: contentApi.getContent,
  listContents: contentApi.listContents,
  deleteContent: contentApi.deleteContent,

  // ============================================================================
  // Tasks API
  // ============================================================================
  listTasks: tasksApi.listTasks,
  getTask: tasksApi.getTask,
  createTask: tasksApi.createTask,
  updateTask: tasksApi.updateTask,
  deleteTask: tasksApi.deleteTask,
  listTaskComments: tasksApi.listTaskComments,
  listTaskActivityLogs: tasksApi.listTaskActivityLogs,
  createTaskComment: tasksApi.createTaskComment,
  listTaskStatuses: tasksApi.listTaskStatuses,

  // ============================================================================
  // Media API
  // ============================================================================
  uploadMedia: mediaApi.uploadMedia,
  getMediaUrl: mediaApi.getMediaUrl,
  getMedia: mediaApi.getMedia,
  deleteMedia: mediaApi.deleteMedia,

  // ============================================================================
  // Social Accounts API
  // ============================================================================
  listSocialAccounts: socialApi.listSocialAccounts,
  disconnectSocialAccount: socialApi.disconnectSocialAccount,
  markSocialAccountExpired: socialApi.markSocialAccountExpired,
  deleteSocialAccount: socialApi.deleteSocialAccount,
  getFacebookAuthorizeUrl: socialApi.getFacebookAuthorizeUrl,
  getLinkedInAuthorizeUrl: socialApi.getLinkedInAuthorizeUrl,
  getLinkedInOptions: socialApi.getLinkedInOptions,
  saveLinkedInSelection: socialApi.saveLinkedInSelection,
  getXAuthorizeUrl: socialApi.getXAuthorizeUrl,
  getTikTokAuthorizeUrl: socialApi.getTikTokAuthorizeUrl,
  getYouTubeAuthorizeUrl: socialApi.getYouTubeAuthorizeUrl,
  getPinterestAuthorizeUrl: socialApi.getPinterestAuthorizeUrl,

  // ============================================================================
  // Integrations API
  // ============================================================================
  listIntegrations: integrationsApi.listIntegrations,
  getGoogleDriveAuthUrl: integrationsApi.getGoogleDriveAuthUrl,
  disconnectGoogleDrive: integrationsApi.disconnectGoogleDrive,
  getGoogleDriveStatus: integrationsApi.getGoogleDriveStatus,
  listGoogleDriveSharedDrives: integrationsApi.listGoogleDriveSharedDrives,
  listGoogleDriveFiles: integrationsApi.listGoogleDriveFiles,
  getGoogleDriveThumbnailUrl: integrationsApi.getGoogleDriveThumbnailUrl,
  importGoogleDriveFile: integrationsApi.importGoogleDriveFile,

  // ============================================================================
  // Tags API
  // ============================================================================
  searchTags: tagsApi.searchTags,

  // ============================================================================
  // Cache Management (backward compatibility)
  // ============================================================================
  clearAllCache: () => apiCache.clearAll(),
};
