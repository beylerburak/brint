/**
 * LinkedIn OAuth Routes
 * 
 * Handles LinkedIn OAuth authorization, callback, and account selection endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildLinkedInAuthorizeUrl, handleLinkedInCallback } from './linkedin-oauth.service.js';
import { requireWorkspaceRoleFor } from '../../../core/auth/workspace-guard.js';
import { linkedinConfig } from '../../../config/linkedin.config.js';
import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
import { getPlanLimits, canAddSocialAccount } from '@brint/shared-config/plans';

export async function registerLinkedInRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/linkedin/authorize
  // Get LinkedIn OAuth authorize URL
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/linkedin/authorize', {
    preHandler: requireWorkspaceRoleFor('social-account:create'),
    schema: {
      tags: ['Social Account - LinkedIn'],
      summary: 'Get LinkedIn OAuth authorize URL',
      description: 'Returns the LinkedIn OAuth authorization URL to redirect the user to. Requires ADMIN role.',
      querystring: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            default: 'tr',
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as {
      workspaceId: string;
      brandId: string;
    };
    const { locale } = request.query as { locale?: string };
    const userId = request.auth?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        },
      });
    }

    try {
      // Verify brand belongs to workspace
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          workspaceId,
        },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      // Build authorize URL with locale
      const authorizeUrl = buildLinkedInAuthorizeUrl({
        brandId,
        workspaceId,
        userId,
        locale: locale || 'tr',
      });

      return reply.status(200).send({
        success: true,
        authorizeUrl,
      });
    } catch (error) {
      request.log.error({ error, workspaceId, brandId }, 'Failed to generate LinkedIn authorize URL');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUTHORIZE_URL_FAILED',
          message: 'Failed to generate authorization URL',
        },
      });
    }
  });

  // ============================================================================
  // GET /v1/social-accounts/oauth/linkedin/callback
  // LinkedIn OAuth callback handler
  // ============================================================================
  app.get('/v1/social-accounts/oauth/linkedin/callback', {
    schema: {
      tags: ['Social Account - LinkedIn'],
      summary: 'LinkedIn OAuth callback',
      description: 'Handles LinkedIn OAuth callback and redirects to frontend.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };

    if (!code || !state) {
      request.log.warn('LinkedIn callback missing code or state');
      const errorUrl = `${linkedinConfig.frontendUrl}/auth/error?source=linkedin&error=missing_params`;
      return reply.redirect(302, errorUrl);
    }

    try {
      // Decode state to get workspaceId (we need it for the service call)
      const { decodeLinkedInState } = await import('./linkedin-state.js');
      const decoded = decodeLinkedInState(state);
      const workspaceId = decoded.workspaceId;

      // Handle callback
      const result = await handleLinkedInCallback(code, state, workspaceId);

      // Fetch workspace and brand slugs for redirect URL
      const workspace = await prisma.workspace.findUnique({
        where: { id: result.workspaceId },
        select: { slug: true },
      });

      const brand = await prisma.brand.findUnique({
        where: { id: result.brandId },
        select: { slug: true },
      });

      if (!workspace || !brand) {
        request.log.error({ workspaceId: result.workspaceId, brandId: result.brandId }, 'Workspace or brand not found for redirect');
        const errorUrl = `${linkedinConfig.frontendUrl}/auth/error?source=linkedin&error=not_found`;
        return reply.redirect(302, errorUrl);
      }

      // Redirect to frontend success page with slugs
      const locale = result.locale || 'tr';
      const successUrl = `${linkedinConfig.frontendUrl}/${locale}/${workspace.slug}/${brand.slug}/social-accounts?connected=linkedin`;
      return reply.redirect(302, successUrl);
    } catch (error) {
      request.log.error({ error, code: !!code, state: !!state }, 'LinkedIn callback error');
      
      // Redirect to frontend error page
      const errorUrl = `${linkedinConfig.frontendUrl}/auth/error?source=linkedin&error=callback_failed`;
      return reply.redirect(302, errorUrl);
    }
  });

  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/linkedin/options
  // Get LinkedIn account options for selection
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/linkedin/options', {
    preHandler: requireWorkspaceRoleFor('social-account:view'),
    schema: {
      tags: ['Social Account - LinkedIn'],
      summary: 'Get LinkedIn account options',
      description: 'Get all LinkedIn accounts (member + organizations) for a brand to allow user selection. If there is a pending token, fetches accounts from LinkedIn API. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as {
      workspaceId: string;
      brandId: string;
    };

    try {
      // Verify brand belongs to workspace
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          workspaceId,
        },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      // Check if there's a pending LinkedIn account (from OAuth callback)
      const pendingAccount = await prisma.socialAccount.findFirst({
        where: {
          brandId,
          platform: 'LINKEDIN',
          platformAccountId: {
            startsWith: 'pending_',
          },
        },
        select: {
          id: true,
          accessToken: true,
          tokenData: true,
        },
      });

      let accounts: any[] = [];

      if (pendingAccount) {
        // Fetch accounts from LinkedIn API using pending token
        const { fetchLinkedInProfile, fetchLinkedInOrganizations } = await import('./linkedin-oauth.service.js');
        
        try {
          const accessToken = pendingAccount.accessToken;
          
          // Fetch member profile
          const profile = await fetchLinkedInProfile(accessToken);
          const memberPlatformAccountId = profile.sub || profile.id || String(profile.id);
          const memberAccount = {
            id: `pending_member_${memberPlatformAccountId}`,
            platformAccountId: memberPlatformAccountId,
            displayName: profile.name || null,
            username: profile.preferred_username || null,
            externalAvatarUrl: profile.picture || null,
            avatarUrl: null,
            canPublish: false,
            tokenData: { kind: 'member' },
            status: 'ACTIVE',
            isPending: true, // Mark as pending (not yet saved)
          };

          // Fetch organizations
          let organizations: any[] = [];
          try {
            organizations = await fetchLinkedInOrganizations(accessToken);
          } catch (orgError) {
            logger.warn({ error: orgError }, 'Failed to fetch organizations for pending account');
          }

          const orgAccounts = organizations.map((org) => {
            const orgId = String(org.id);
            return {
              id: `pending_org_${orgId}`,
              platformAccountId: orgId,
              displayName: org.localizedName || null,
              username: org.vanityName || null,
              externalAvatarUrl: org.logoUrl || null,
              avatarUrl: null,
              canPublish: false,
              tokenData: { kind: 'organization' },
              status: 'ACTIVE',
              isPending: true,
            };
          });

          accounts = [memberAccount, ...orgAccounts];
        } catch (error) {
          request.log.error({ error }, 'Failed to fetch LinkedIn accounts from pending token');
          // Fall through to return existing accounts
        }
      }

      // If no pending account or fetch failed, get existing accounts
      if (accounts.length === 0) {
        const existingAccounts = await prisma.socialAccount.findMany({
          where: {
            brandId,
            platform: 'LINKEDIN',
            platformAccountId: {
              not: {
                startsWith: 'pending_',
              },
            },
          },
          select: {
            id: true,
            platformAccountId: true,
            displayName: true,
            username: true,
            externalAvatarUrl: true,
            avatarUrl: true,
            canPublish: true,
            tokenData: true,
            status: true,
          },
          orderBy: [
            { tokenData: 'asc' },
            { displayName: 'asc' },
          ],
        });

        accounts = existingAccounts.map((acc) => ({
          id: acc.id,
          platformAccountId: acc.platformAccountId,
          displayName: acc.displayName,
          username: acc.username,
          externalAvatarUrl: acc.externalAvatarUrl,
          avatarUrl: acc.avatarUrl,
          canPublish: acc.canPublish,
          tokenData: acc.tokenData,
          status: acc.status,
          isPending: false,
        }));
      }

      return reply.status(200).send({
        success: true,
        accounts,
        hasPendingToken: !!pendingAccount,
      });
    } catch (error) {
      request.log.error({ error, workspaceId, brandId }, 'Failed to get LinkedIn options');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_OPTIONS_FAILED',
          message: 'Failed to get LinkedIn account options',
        },
      });
    }
  });

  // ============================================================================
  // POST /workspaces/:workspaceId/brands/:brandId/social-accounts/linkedin/selection
  // Save LinkedIn account selection
  // ============================================================================
  app.post('/workspaces/:workspaceId/brands/:brandId/social-accounts/linkedin/selection', {
    preHandler: requireWorkspaceRoleFor('social-account:update'),
    schema: {
      tags: ['Social Account - LinkedIn'],
      summary: 'Save LinkedIn account selection',
      description: 'Save selected LinkedIn accounts. If there is a pending token, fetches accounts and saves selected ones. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as {
      workspaceId: string;
      brandId: string;
    };
    const { selectedIds } = request.body as { selectedIds: string[] };

    if (!Array.isArray(selectedIds)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'selectedIds must be an array',
        },
      });
    }

    try {
      const userId = request.auth?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User ID is required',
          },
        });
      }

      // Verify brand belongs to workspace and get workspace plan
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          workspaceId,
        },
        select: { 
          id: true,
          workspace: {
            select: {
              plan: true,
            },
          },
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      const workspacePlan = brand.workspace.plan;

      // Check if there's a pending account (from OAuth callback)
      const pendingAccount = await prisma.socialAccount.findFirst({
        where: {
          brandId,
          platform: 'LINKEDIN',
          platformAccountId: {
            startsWith: 'pending_',
          },
        },
        select: {
          id: true,
          accessToken: true,
          tokenExpiresAt: true,
          tokenData: true,
        },
      });

      // If there's a pending account, at least one account must be selected
      if (pendingAccount && selectedIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one LinkedIn account must be selected',
          },
        });
      }

      // Check plan limits for LinkedIn accounts
      if (pendingAccount && selectedIds.length > 0) {
        const currentLinkedInCount = await prisma.socialAccount.count({
          where: {
            brandId,
            platform: 'LINKEDIN',
            platformAccountId: {
              not: {
                startsWith: 'pending_',
              },
            },
          },
        });

        // Calculate how many new accounts will be created
        // We need to check if adding selectedIds would exceed the limit
        // For now, we'll check if current count + selectedIds.length exceeds limit
        // Note: Some selectedIds might already exist, but we check conservatively
        const totalAfterSelection = currentLinkedInCount + selectedIds.length;
        const limits = getPlanLimits(workspacePlan);
        
        if (limits.maxSocialAccountsPerPlatform !== -1 && totalAfterSelection > limits.maxSocialAccountsPerPlatform) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PLAN_LIMIT_REACHED',
              message: `Maximum ${limits.maxSocialAccountsPerPlatform} LinkedIn account(s) per brand allowed for ${workspacePlan} plan`,
            },
          });
        }
      }

      if (pendingAccount) {
        logger.info({ 
          pendingAccountId: pendingAccount.id,
          hasTokenData: !!pendingAccount.tokenData,
          tokenDataType: typeof pendingAccount.tokenData
        }, 'Processing pending LinkedIn account');
        
        // Fetch accounts from LinkedIn API and save selected ones
        const { fetchLinkedInProfile, fetchLinkedInOrganizations, saveLinkedInMemberProfile, saveLinkedInOrganizations } = await import('./linkedin-oauth.service.js');
        const { createOrUpdateFromOAuth } = await import('../social-account.service.js');
        
        const accessToken = pendingAccount.accessToken;
        if (!accessToken) {
          throw new Error('Pending account missing access token');
        }
        
        const expiresIn = pendingAccount.tokenExpiresAt 
          ? Math.max(0, Math.floor((pendingAccount.tokenExpiresAt.getTime() - Date.now()) / 1000))
          : 5184000; // Default to 60 days if not set

        // Get profile from pending account tokenData if available, otherwise fetch
        let profile: any;
        const pendingTokenData = pendingAccount.tokenData as any;
        logger.info({ 
          hasTokenData: !!pendingTokenData,
          tokenDataKind: pendingTokenData?.kind,
          hasProfile: !!pendingTokenData?.profile,
          hasOrganizations: !!pendingTokenData?.organizations
        }, 'Checking pending account tokenData');
        
        if (pendingTokenData?.kind === 'pending' && pendingTokenData?.profile) {
          profile = pendingTokenData.profile;
          logger.info('Using profile from pending account tokenData');
        } else {
          logger.info('Fetching profile from LinkedIn API');
          profile = await fetchLinkedInProfile(accessToken);
        }
        const memberPlatformAccountId = profile.sub || profile.id || String(profile.id);
        
        // Check if member is selected (match by ID format: pending_member_{platformAccountId})
        const memberSelected = selectedIds.some(id => 
          id === `pending_member_${memberPlatformAccountId}` ||
          id === memberPlatformAccountId
        );
        
        if (memberSelected) {
          try {
            await saveLinkedInMemberProfile(
              brandId,
              workspaceId,
              userId,
              profile,
              accessToken,
              expiresIn
            );
            
            // Set canPublish to true for selected member account
            await prisma.socialAccount.updateMany({
              where: {
                brandId,
                platform: 'LINKEDIN',
                platformAccountId: memberPlatformAccountId,
              },
              data: {
                canPublish: true,
              },
            });
            
            logger.info({ memberPlatformAccountId }, 'LinkedIn member profile saved successfully');
          } catch (saveError) {
            logger.error({ error: saveError, memberPlatformAccountId }, 'Failed to save LinkedIn member profile');
            throw new Error(`Failed to save LinkedIn member profile: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
          }
        }

        // Fetch organizations - try from pending account tokenData first, then API
        let organizations: any[] = [];
        
        // Check if organizations are stored in pending account tokenData
        if (pendingTokenData?.kind === 'pending' && pendingTokenData?.organizations && Array.isArray(pendingTokenData.organizations)) {
          organizations = pendingTokenData.organizations;
          logger.info({ orgCount: organizations.length, orgIds: organizations.map((o: any) => o.id) }, 'Using organizations from pending account tokenData');
        } else {
          // Try to fetch from API
          logger.info('Fetching organizations from LinkedIn API');
          try {
            organizations = await fetchLinkedInOrganizations(accessToken);
            logger.info({ orgCount: organizations.length, orgIds: organizations.map((o: any) => o.id) }, 'Fetched LinkedIn organizations from API');
          } catch (orgError) {
            logger.error({ 
              error: orgError,
              errorMessage: orgError instanceof Error ? orgError.message : String(orgError),
              errorStack: orgError instanceof Error ? orgError.stack : undefined
            }, 'Failed to fetch organizations for selection');
            // If user selected an org but fetch failed and no cached orgs, throw error
            const hasOrgSelection = selectedIds.some(id => id.startsWith('pending_org_'));
            if (hasOrgSelection && organizations.length === 0) {
              throw new Error(`Failed to fetch LinkedIn organizations: ${orgError instanceof Error ? orgError.message : String(orgError)}`);
            }
          }
        }

        // Save selected organizations (match by ID format: pending_org_{platformAccountId})
        const selectedOrgs = organizations.filter((org) => {
          const orgId = String(org.id);
          return selectedIds.some(id => 
            id === `pending_org_${orgId}` ||
            id === orgId
          );
        });

        logger.info({ 
          selectedIds, 
          orgCount: organizations.length, 
          selectedOrgCount: selectedOrgs.length,
          orgIds: organizations.map(o => String(o.id))
        }, 'Processing LinkedIn organization selection');

        if (selectedOrgs.length > 0) {
          try {
            await saveLinkedInOrganizations(
              brandId,
              workspaceId,
              userId,
              selectedOrgs,
              accessToken,
              expiresIn
            );
            
            // Set canPublish to true for selected organization accounts
            const selectedOrgIds = selectedOrgs.map(org => String(org.id));
            await prisma.socialAccount.updateMany({
              where: {
                brandId,
                platform: 'LINKEDIN',
                platformAccountId: {
                  in: selectedOrgIds,
                },
              },
              data: {
                canPublish: true,
              },
            });
            
            logger.info({ selectedOrgIds }, 'LinkedIn organizations saved successfully');
          } catch (saveError) {
            logger.error({ 
              error: saveError, 
              selectedOrgs: selectedOrgs.map(o => ({ id: o.id, name: o.localizedName }))
            }, 'Failed to save LinkedIn organizations');
            throw new Error(`Failed to save LinkedIn organizations: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
          }
        } else if (selectedIds.some(id => id.startsWith('pending_org_'))) {
          // User selected an org but it wasn't found in the fetched list
          throw new Error(`Selected LinkedIn organization not found. Available organizations: ${organizations.map(o => String(o.id)).join(', ') || 'none'}`);
        }

        // Delete pending account
        await prisma.socialAccount.delete({
          where: { id: pendingAccount.id },
        });

        logger.info(
          { brandId, memberSelected, orgCount: selectedOrgs.length },
          'LinkedIn accounts saved from pending token'
        );
      } else {
        // No pending account - update existing accounts' canPublish flags
        const allAccounts = await prisma.socialAccount.findMany({
          where: {
            brandId,
            platform: 'LINKEDIN',
            platformAccountId: {
              not: {
                startsWith: 'pending_',
              },
            },
          },
          select: { id: true },
        });

        await prisma.$transaction(
          allAccounts.map((account) =>
            prisma.socialAccount.update({
              where: { id: account.id },
              data: {
                canPublish: selectedIds.includes(account.id),
              },
            })
          )
        );

        logger.info(
          { brandId, selectedCount: selectedIds.length, totalCount: allAccounts.length },
          'LinkedIn account selection updated'
        );
      }

      return reply.status(200).send({
        success: true,
        message: 'LinkedIn account selection saved successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      request.log.error({ 
        error, 
        workspaceId, 
        brandId,
        selectedIds,
        errorMessage,
        errorStack
      }, 'Failed to save LinkedIn selection');
      
      // Return detailed error message to help with debugging
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SAVE_SELECTION_FAILED',
          message: errorMessage || 'Failed to save LinkedIn account selection',
          // Include stack trace in development
          ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {}),
        },
      });
    }
  });
}
