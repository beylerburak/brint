/**
 * Social Accounts API
 * 
 * Social media account management endpoints
 */

import { fetchApi } from './http';

export type SocialPlatform = 
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'TIKTOK'
  | 'LINKEDIN'
  | 'X'
  | 'YOUTUBE'
  | 'WHATSAPP'
  | 'PINTEREST';

export type SocialAccountStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type SocialAccountDto = {
  id: string;
  platform: SocialPlatform;
  platformAccountId: string;
  displayName: string | null;
  username: string | null;
  externalAvatarUrl: string | null;
  avatarUrl: string | null;
  status: SocialAccountStatus;
  canPublish: boolean;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export const socialApi = {
  /**
   * List social accounts for a brand
   */
  async listSocialAccounts(
    workspaceId: string,
    brandId: string,
    options?: { platform?: SocialPlatform; status?: SocialAccountStatus }
  ): Promise<{
    success: true;
    socialAccounts: SocialAccountDto[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.platform) params.append('platform', options.platform);
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts${query}`);
  },

  /**
   * Disconnect a social account
   */
  async disconnectSocialAccount(
    workspaceId: string,
    brandId: string,
    accountId: string
  ): Promise<{
    success: true;
    socialAccount: SocialAccountDto;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/${accountId}/disconnect`, {
      method: 'POST',
    });
  },

  /**
   * Mark a social account as expired
   */
  async markSocialAccountExpired(
    workspaceId: string,
    brandId: string,
    accountId: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<{
    success: true;
    socialAccount: SocialAccountDto;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/${accountId}/mark-expired`, {
      method: 'POST',
      body: JSON.stringify({ errorCode, errorMessage }),
    });
  },

  /**
   * Delete a social account
   */
  async deleteSocialAccount(
    workspaceId: string,
    brandId: string,
    accountId: string
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/${accountId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get Facebook OAuth authorize URL
   */
  async getFacebookAuthorizeUrl(
    workspaceId: string,
    brandId: string,
    locale?: string
  ): Promise<{
    success: true;
    authorizeUrl: string;
  }> {
    const params = new URLSearchParams();
    if (locale) params.append('locale', locale);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/facebook/authorize${query}`);
  },

  /**
   * Get LinkedIn OAuth authorize URL
   */
  async getLinkedInAuthorizeUrl(
    workspaceId: string,
    brandId: string,
    locale?: string
  ): Promise<{
    success: true;
    authorizeUrl: string;
  }> {
    const params = new URLSearchParams();
    if (locale) params.append('locale', locale);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/linkedin/authorize${query}`);
  },

  /**
   * Get LinkedIn account options for selection
   */
  async getLinkedInOptions(
    workspaceId: string,
    brandId: string
  ): Promise<{
    success: true;
    accounts: Array<{
      id: string;
      platformAccountId: string;
      displayName: string | null;
      username: string | null;
      externalAvatarUrl: string | null;
      avatarUrl: string | null;
      canPublish: boolean;
      tokenData: { kind?: 'member' | 'organization' } | null;
      status: SocialAccountStatus;
      isPending?: boolean;
    }>;
    hasPendingToken?: boolean;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/linkedin/options`);
  },

  /**
   * Save LinkedIn account selection
   */
  async saveLinkedInSelection(
    workspaceId: string,
    brandId: string,
    selectedIds: string[]
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/linkedin/selection`, {
      method: 'POST',
      body: JSON.stringify({ selectedIds }),
    });
  },

  /**
   * Get X OAuth authorize URL
   */
  async getXAuthorizeUrl(
    workspaceId: string,
    brandId: string,
    locale?: string
  ): Promise<{
    success: true;
    authorizeUrl: string;
  }> {
    const params = new URLSearchParams();
    if (locale) params.append('locale', locale);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/x/authorize${query}`);
  },

  /**
   * Get TikTok OAuth authorize URL
   */
  async getTikTokAuthorizeUrl(
    workspaceId: string,
    brandId: string,
    locale?: string
  ): Promise<{
    success: true;
    authorizeUrl: string;
  }> {
    const params = new URLSearchParams();
    if (locale) params.append('locale', locale);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/tiktok/authorize${query}`);
  },

  /**
   * Get YouTube OAuth authorize URL
   */
  async getYouTubeAuthorizeUrl(
    workspaceId: string,
    brandId: string,
    locale?: string
  ): Promise<{
    success: true;
    authorizeUrl: string;
  }> {
    const params = new URLSearchParams();
    if (locale) params.append('locale', locale);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/youtube/authorize${query}`);
  },

  /**
   * Get Pinterest OAuth authorize URL
   */
  async getPinterestAuthorizeUrl(
    workspaceId: string,
    brandId: string,
    locale?: string
  ): Promise<{
    success: true;
    authorizeUrl: string;
  }> {
    const params = new URLSearchParams();
    if (locale) params.append('locale', locale);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/social-accounts/pinterest/authorize${query}`);
  },
};
