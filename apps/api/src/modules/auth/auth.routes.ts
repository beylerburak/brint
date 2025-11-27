import { randomBytes, randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { redis } from '../../lib/redis.js';
import { oauthConfig, authConfig, appUrlConfig } from '../../config/index.js';
import { loginOrRegisterWithGoogle, type GoogleProfile } from './google-oauth.service.js';
import { setAuthCookies, clearAuthCookies } from '../../core/auth/auth.cookies.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { magicLinkService } from './magic-link.service.js';
import { sendMagicLinkEmail } from '../../core/email/email.service.js';
import { permissionService } from '../../core/auth/permission.service.js';
import { BadRequestError, UnauthorizedError } from '../../lib/http-errors.js';

/**
 * Registers authentication routes
 * - GET /auth/google - Generate Google OAuth URL
 * - GET /auth/google/callback - Handle Google OAuth callback
 * - POST /auth/refresh - Refresh access token using refresh token
 * - POST /auth/logout - Logout and revoke session
 * - POST /auth/magic-link - Request magic link email
 * - GET /auth/magic-link/verify - Verify magic link token and login
 * - GET /auth/me - Get current user and workspace information
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // GET /auth/google - Generate OAuth URL
  app.get('/auth/google', {
    schema: {
      tags: ['Auth'],
      summary: 'Get Google OAuth redirect URL',
      description: 'Returns the Google OAuth authorization URL with a state parameter for CSRF protection',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
          required: ['success', 'redirectUrl'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Generate state
    const state = randomBytes(32).toString('hex');

    // 2. Store state in Redis (TTL: 600 seconds = 10 minutes)
    await redis.set(`oauth:google:state:${state}`, '1', 'EX', 600);

    // 3. Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: oauthConfig.google.clientId,
      redirect_uri: oauthConfig.google.redirectUri,
      response_type: 'code',
      scope: oauthConfig.google.scopes.join(' '),
      access_type: 'offline',
      prompt: 'select_account',
      state,
    });

    const redirectUrl = `${oauthConfig.google.authBaseUrl}?${params.toString()}`;

    return reply.status(200).send({
      success: true,
      redirectUrl,
    });
  });

  // GET /auth/google/callback - Handle OAuth callback
  app.get('/auth/google/callback', {
    schema: {
      tags: ['Auth'],
      summary: 'Handle Google OAuth callback',
      description: 'Exchanges authorization code for tokens and creates/updates user session',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          redirect_url: { type: 'string' },
        },
        required: ['code', 'state'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: ['string', 'null'] },
              },
              required: ['id', 'email'],
            },
            redirectTo: { type: 'string' },
          },
          required: ['success', 'user', 'redirectTo'],
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { code?: string; state?: string; redirect_url?: string } }>, reply: FastifyReply) => {
    const { code, state, redirect_url: redirectUrlOverride } = request.query;

    // 1. Validate query parameters
    if (!code || !state) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'OAUTH_BAD_REQUEST',
          message: 'Missing required parameters: code and state are required',
        },
      });
    }

    // 2. Validate state from Redis
    const stateKey = `oauth:google:state:${state}`;
    const storedState = await redis.get(stateKey);

    if (!storedState) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'OAUTH_STATE_INVALID',
          message: 'Invalid or expired state parameter',
        },
      });
    }

    // Delete state after validation (one-time use)
    await redis.del(stateKey);

    try {
      // 3. Exchange code for tokens
      const tokenResponse = await fetch(oauthConfig.google.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: oauthConfig.google.clientId,
          client_secret: oauthConfig.google.clientSecret,
          redirect_uri: oauthConfig.google.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error(
          {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            error: errorText,
          },
          'Google OAuth token exchange failed'
        );
        return reply.status(401).send({
          success: false,
          error: {
            code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
            message: 'Failed to exchange authorization code for tokens',
          },
        });
      }

      const tokenData = await tokenResponse.json() as { id_token?: string; access_token?: string; refresh_token?: string };

      // 4. Decode id_token (basic profile)
      if (!tokenData.id_token) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OAUTH_NO_ID_TOKEN',
            message: 'No id_token received from Google',
          },
        });
      }

      // Decode without verification for now (will add verification later)
      const decoded = jwt.decode(tokenData.id_token) as GoogleProfile | null;

      // 4b. Optionally fetch userinfo (to get phone_number and freshest fields)
      let userinfo: Partial<GoogleProfile> | null = null;
      if (tokenData.access_token) {
        try {
          const userInfoResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          });
          if (userInfoResp.ok) {
            userinfo = await userInfoResp.json() as Partial<GoogleProfile>;
          } else {
            const text = await userInfoResp.text();
            logger.warn({ status: userInfoResp.status, text }, 'Google userinfo fetch failed');
          }
        } catch (err) {
          logger.warn({ err }, 'Google userinfo fetch error');
        }
      }

      const profile: GoogleProfile = {
        sub: userinfo?.sub ?? decoded?.sub ?? '',
        email: userinfo?.email ?? decoded?.email ?? '',
        email_verified: userinfo?.email_verified ?? decoded?.email_verified,
        name: userinfo?.name ?? decoded?.name,
        phone_number: userinfo?.phone_number ?? decoded?.phone_number,
      };

      if (!profile.email || !profile.sub) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OAUTH_PROFILE_INCOMPLETE',
            message: 'Missing required fields from Google profile (email/sub)',
          },
        });
      }

      logger.info(
        {
          email: profile.email,
          sub: profile.sub,
          name: profile.name,
          phone: profile.phone_number,
          hasAccessToken: !!tokenData.access_token,
        },
        'Google OAuth profile resolved'
      );

      // 5. Login or register user
      const result = await loginOrRegisterWithGoogle(profile, {
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
      });

      // 6. Set cookies
      setAuthCookies(reply, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // 7. If redirect override is provided, redirect after setting cookies
      if (redirectUrlOverride) {
        return reply.redirect(redirectUrlOverride);
      }

      // 8. Return success response
      return reply.status(200).send({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        redirectTo: '/',
      });
    } catch (error) {
      const safeError = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { error };

      logger.error(
        {
          error: safeError,
          code,
          state,
        },
        'Error in Google OAuth callback'
      );

      return reply.status(500).send({
        success: false,
        error: {
          code: 'OAUTH_CALLBACK_ERROR',
          message: 'An unexpected error occurred during OAuth callback',
        },
      });
    }
  });

  // POST /auth/refresh - Refresh access token
  app.post('/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description: 'Generates new access and refresh tokens using the existing refresh token from cookie. Implements token rotation.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            accessToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
          required: ['success', 'accessToken', 'expiresIn'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Get refresh token from cookie
    const refreshToken = request.cookies['refresh_token'];

    if (!refreshToken) {
      logger.warn(
        {
          reason: 'missing-token',
        },
        'Refresh attempt without token'
      );
      return reply.status(401).send({
        success: false,
        error: {
          code: 'AUTH_REFRESH_MISSING_TOKEN',
          message: 'Refresh token not found in cookies',
        },
      });
    }

    try {
      // 2. Verify refresh token
      const payload = tokenService.verifyRefreshToken(refreshToken);
      const { sub: userId, tid: oldTid } = payload;

      logger.debug(
        {
          userId,
          oldTid,
        },
        'Refresh token verified'
      );

      // 3. Find session in DB
      const session = await prisma.session.findUnique({
        where: { id: oldTid },
      });

      if (!session) {
        logger.warn(
          {
            userId,
            oldTid,
            reason: 'session-not-found',
          },
          'Refresh attempt with non-existent session'
        );
        clearAuthCookies(reply);
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_REFRESH_SESSION_NOT_FOUND',
            message: 'Session not found',
          },
        });
      }

      // 4. Check if session is expired
      const now = new Date();
      if (session.expiresAt <= now) {
        logger.warn(
          {
            userId,
            oldTid,
            reason: 'session-expired',
            expiresAt: session.expiresAt.toISOString(),
          },
          'Refresh attempt with expired session'
        );
        // Best-effort revoke
        await sessionService.revokeSession(oldTid).catch((err) => {
          logger.error({ error: err, oldTid }, 'Failed to revoke expired session during refresh');
        });
        clearAuthCookies(reply);
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_REFRESH_SESSION_EXPIRED',
            message: 'Session expired',
          },
        });
      }

      // 5. Token rotation: Create new session
      const newTid = randomUUID();
      await sessionService.createSession({
        userId,
        tid: newTid,
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
      });

      // 6. Revoke old session (best-effort, don't fail if it errors)
      await sessionService.revokeSession(oldTid).catch((err) => {
        logger.error(
          {
            error: err,
            userId,
            oldTid,
            newTid,
          },
          'Failed to revoke old session during rotation (non-fatal)'
        );
      });

      // 7. Generate new tokens
      const accessToken = tokenService.signAccessToken({ sub: userId });
      const newRefreshToken = tokenService.signRefreshToken({ sub: userId, tid: newTid });

      // 8. Set new cookies
      setAuthCookies(reply, {
        accessToken,
        refreshToken: newRefreshToken,
      });

      logger.info(
        {
          userId,
          oldTid,
          newTid,
          reason: 'ok',
        },
        'Token refresh successful with rotation'
      );

      // 9. Return response
      return reply.status(200).send({
        success: true,
        accessToken,
        expiresIn: authConfig.accessToken.expiresInMinutes,
      });
    } catch (error: any) {
      // Handle TokenError from verifyRefreshToken
      if (error?.name === 'TokenError' || error?.message?.includes('Token')) {
        logger.warn(
          {
            error: error.message,
            reason: 'invalid-token',
          },
          'Refresh attempt with invalid token'
        );
        clearAuthCookies(reply);
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_REFRESH_INVALID_TOKEN',
            message: 'Invalid or expired refresh token',
          },
        });
      }

      // Unexpected error
      logger.error(
        {
          error,
        },
        'Unexpected error during token refresh'
      );
      clearAuthCookies(reply);
      return reply.status(401).send({
        success: false,
        error: {
          code: 'AUTH_REFRESH_FAILED',
          message: 'Token refresh failed',
        },
      });
    }
  });

  // POST /auth/logout - Logout and revoke session
  app.post('/auth/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout user',
      description: 'Revokes the current session and clears authentication cookies',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
          required: ['success'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies['refresh_token'];

    if (refreshToken) {
      try {
        // Try to decode and revoke session
        const payload = tokenService.verifyRefreshToken(refreshToken);
        const { tid } = payload;

        // Best-effort revoke (don't fail if it errors)
        await sessionService.revokeSession(tid).catch((err) => {
          logger.error(
            {
              error: err,
              tid,
            },
            'Failed to revoke session during logout (non-fatal)'
          );
        });

        logger.info(
          {
            userId: payload.sub,
            tid,
            reason: 'ok',
          },
          'Logout successful'
        );
      } catch (error: any) {
        // If token is invalid/expired, just log and continue (still return success)
        logger.warn(
          {
            error: error.message,
            reason: 'invalid-token',
          },
          'Logout with invalid refresh token (non-fatal)'
        );
      }
    } else {
      logger.debug(
        {
          reason: 'no-token',
        },
        'Logout without refresh token'
      );
    }

    // Always clear cookies
    clearAuthCookies(reply);

    return reply.status(200).send({
      success: true,
    });
  });

  // POST /auth/magic-link - Request magic link email
  app.post('/auth/magic-link', {
    schema: {
      tags: ['Auth'],
      summary: 'Request magic link email',
      description: 'Generates a magic link token and sends it via email (stub)',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          redirectTo: { type: 'string' },
        },
        required: ['email'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['success', 'message'],
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; redirectTo?: string } }>, reply: FastifyReply) => {
    const { email, redirectTo } = request.body;

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'AUTH_MAGIC_LINK_INVALID_EMAIL',
          message: 'Email is required',
        },
      });
    }

    try {
      // Create magic link
      const result = await magicLinkService.createMagicLink({
        email,
        redirectTo: redirectTo ?? null,
      });

      // Generate magic link URL (frontend domain)
      // Note: Frontend handles locale routing, so we use the base URL
      const magicLinkUrl = `${appUrlConfig.baseUrl}/auth/magic-link/verify?token=${result.token}`;

      // Send email via SMTP (or log if SMTP not configured)
      await sendMagicLinkEmail(result.payload.email, magicLinkUrl);

      // Return generic success (don't leak user existence)
      return reply.status(200).send({
        success: true,
        message: 'If an account exists for this email, a magic link has been sent.',
      });
    } catch (error: any) {
      logger.error(
        {
          error,
          email,
        },
        'Error creating magic link'
      );

      // Return generic error to avoid leaking information
      return reply.status(200).send({
        success: true,
        message: 'If an account exists for this email, a magic link has been sent.',
      });
    }
  });

  // GET /auth/permissions - Permission snapshot for current workspace
  app.get('/auth/permissions', {
    schema: {
      tags: ['Auth'],
      summary: 'Get effective permissions for current workspace',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                workspaceId: { type: 'string' },
                permissions: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['workspaceId', 'permissions'],
            },
          },
          required: ['success', 'data'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, workspaceId } = request.auth ?? {};

    if (!userId) {
      throw new UnauthorizedError('AUTH_REQUIRED');
    }

    if (!workspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'X-Workspace-Id header is required');
    }

    const { permissions } =
      await permissionService.getEffectivePermissionsForUserWorkspace({
        userId,
        workspaceId,
      });

    return reply.send({
      success: true,
      data: {
        workspaceId,
        permissions,
      },
    });
  });

  // GET /auth/me - Get current user and workspace information
  app.get('/auth/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Get current user information',
      description: 'Returns current authenticated user and their workspace memberships',
        response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: ['string', 'null'] },
                  },
                  required: ['id', 'email'],
                },
                ownerWorkspaces: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      slug: { type: 'string' },
                      name: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                    required: ['id', 'slug', 'name', 'updatedAt'],
                  },
                },
                memberWorkspaces: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      slug: { type: 'string' },
                      name: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                    required: ['id', 'slug', 'name', 'updatedAt'],
                  },
                },
              },
              required: ['user', 'ownerWorkspaces', 'memberWorkspaces'],
            },
          },
          required: ['success', 'data'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.auth || !request.auth.userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userId = request.auth.userId;

    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Get all workspace memberships
      const allMemberships = await prisma.workspaceMember.findMany({
        where: { userId },
        include: { workspace: true },
      });

      // Sort by workspace updatedAt (most recently updated first)
      allMemberships.sort((a, b) => 
        b.workspace.updatedAt.getTime() - a.workspace.updatedAt.getTime()
      );

      // Separate owner and member workspaces
      const ownerWorkspaces = allMemberships
        .filter((m) => m.role === 'OWNER')
        .map((m) => ({
          id: m.workspace.id,
          slug: m.workspace.slug,
          name: m.workspace.name,
          updatedAt: m.workspace.updatedAt.toISOString(),
        }));

      const memberWorkspaces = allMemberships
        .filter((m) => m.role !== 'OWNER')
        .map((m) => ({
          id: m.workspace.id,
          slug: m.workspace.slug,
          name: m.workspace.name,
          updatedAt: m.workspace.updatedAt.toISOString(),
        }));

      return reply.status(200).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          ownerWorkspaces,
          memberWorkspaces,
        },
      });
    } catch (error) {
      logger.error(
        {
          error,
          userId,
        },
        'Error getting user information'
      );
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  });

  // GET /auth/magic-link/verify - Verify magic link token and login
  app.get('/auth/magic-link/verify', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify magic link token',
      description: 'Verifies magic link token and creates user session',
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string' },
        },
        required: ['token'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: ['string', 'null'] },
              },
              required: ['id', 'email'],
            },
            workspace: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string' },
                slug: { type: 'string' },
                name: { type: 'string' },
              },
              required: ['id', 'slug', 'name'],
            },
            ownerWorkspaces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  slug: { type: 'string' },
                  name: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['id', 'slug', 'name', 'updatedAt'],
              },
            },
            memberWorkspaces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  slug: { type: 'string' },
                  name: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['id', 'slug', 'name', 'updatedAt'],
              },
            },
            redirectTo: { type: 'string' },
          },
          required: ['success', 'user', 'workspace', 'redirectTo'],
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
    const { token } = request.query;

    if (!token) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'AUTH_MAGIC_LINK_TOKEN_REQUIRED',
          message: 'Token is required',
        },
      });
    }

    try {
      // Consume magic link
      const result = await magicLinkService.consumeMagicLink(token, {
        ipAddress: request.ip ?? null,
        userAgent: request.headers['user-agent'] ?? null,
      });

      // Set auth cookies
      setAuthCookies(reply, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // Return success response with all workspace information
      // Frontend will decide redirect based on workspace ownership and membership
      const response = {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        workspace: result.workspace
          ? {
              id: result.workspace.id,
              slug: result.workspace.slug,
              name: result.workspace.name,
            }
          : null,
        ownerWorkspaces: result.ownerWorkspaces.map((w) => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
          updatedAt: w.updatedAt.toISOString(),
        })),
        memberWorkspaces: result.memberWorkspaces.map((w) => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
          updatedAt: w.updatedAt.toISOString(),
        })),
        redirectTo: result.redirectTo ?? null,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      // Handle MagicLinkError
      if (error?.name === 'MagicLinkError' || error?.message?.includes('Magic link')) {
        logger.warn(
          {
            error: error.message,
            token: token.substring(0, 8) + '...',
          },
          'Magic link verification failed'
        );
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_MAGIC_LINK_INVALID_OR_EXPIRED',
            message: 'Magic link invalid or expired',
          },
        });
      }

      // Unexpected error
      logger.error(
        {
          error,
          token: token.substring(0, 8) + '...',
        },
        'Unexpected error during magic link verification'
      );
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during magic link verification',
        },
      });
    }
  });
}
