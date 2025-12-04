import { randomBytes, randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { redis } from '../../lib/redis.js';
import { oauthConfig, authConfig, appUrlConfig } from '../../config/index.js';
import { loginOrRegisterWithGoogle, type GoogleProfile } from './google-oauth.service.js';
import { setAuthCookies, clearAuthCookies } from '../../core/auth/auth.cookies.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { magicLinkService } from './magic-link.service.js';
import { sendMagicLinkEmailStub } from './email.stub.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';

/**
 * Registers authentication routes
 * - POST /auth/register - Register new user with email and password
 * - POST /auth/login - Login with email and password
 * - GET /auth/google - Generate Google OAuth URL
 * - GET /auth/google/callback - Handle Google OAuth callback
 * - POST /auth/refresh - Refresh access token using refresh token
 * - POST /auth/logout - Logout and revoke session
 * - POST /auth/magic-link - Request magic link email
 * - GET /auth/magic-link/verify - Verify magic link token and login
 * - GET /me - Get current user profile and workspaces
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // GET /me - Get current user profile and workspaces
  app.get('/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Get current user',
      description: 'Returns current authenticated user profile and their workspaces',
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
                username: { type: ['string', 'null'] },
                avatarMediaId: { type: ['string', 'null'] },
                avatarUrls: {
                  type: ['object', 'null'],
                  properties: {
                    thumbnail: { type: ['string', 'null'] },
                    small: { type: ['string', 'null'] },
                    medium: { type: ['string', 'null'] },
                    large: { type: ['string', 'null'] },
                  },
                },
                emailVerified: { type: ['string', 'null'], format: 'date-time' },
                timezonePreference: { type: 'string', enum: ['WORKSPACE', 'LOCAL'] },
                timezone: { type: ['string', 'null'] },
                locale: { type: ['string', 'null'] },
                dateFormat: { type: 'string', enum: ['DMY', 'MDY', 'YMD'] },
                timeFormat: { type: 'string', enum: ['H24', 'H12'] },
                phoneNumber: { type: ['string', 'null'] },
                phoneVerifiedAt: { type: ['string', 'null'], format: 'date-time' },
                onboardingCompletedAt: { type: ['string', 'null'], format: 'date-time' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
              required: ['id', 'email'],
            },
            workspaces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  avatarUrl: { type: ['string', 'null'] },
                  timezone: { type: 'string' },
                  locale: { type: 'string' },
                  baseCurrency: { type: 'string' },
                  plan: { type: 'string', enum: ['FREE', 'STARTER', 'PRO', 'AGENCY'] },
                  role: { type: 'string', enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] },
                },
                required: ['id', 'name', 'slug', 'role'],
              },
            },
          },
          required: ['success', 'user', 'workspaces'],
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
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Check authentication
    if (!request.auth || !request.auth.tokenPayload) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userId = request.auth.tokenPayload.sub;

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatarUrl: true,
        avatarMediaId: true,
        avatarMedia: {
      select: {
        id: true,
        baseKey: true,
        bucket: true,
        variants: true,
        mimeType: true,
        isPublic: true,
      },
        },
        emailVerified: true,
        timezonePreference: true,
        timezone: true,
        locale: true,
        dateFormat: true,
        timeFormat: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        onboardingCompletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
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

    // Fetch user's workspace memberships
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatarUrl: true,
            timezone: true,
            locale: true,
            baseCurrency: true,
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      avatarUrl: m.workspace.avatarUrl,
      timezone: m.workspace.timezone,
      locale: m.workspace.locale,
      baseCurrency: m.workspace.baseCurrency,
      plan: m.workspace.plan,
      role: m.role,
    }));

    // Generate avatar URLs from media variants (send only URLs, not full media object)
    // Use presigned URLs for private media
    let avatarUrls = null;
    if (user.avatarMedia) {
      const isPublic = user.avatarMedia.isPublic ?? false;
      avatarUrls = {
        thumbnail: await getMediaVariantUrlAsync(user.avatarMedia.bucket, user.avatarMedia.variants, 'thumbnail', isPublic),
        small: await getMediaVariantUrlAsync(user.avatarMedia.bucket, user.avatarMedia.variants, 'small', isPublic),
        medium: await getMediaVariantUrlAsync(user.avatarMedia.bucket, user.avatarMedia.variants, 'medium', isPublic),
        large: await getMediaVariantUrlAsync(user.avatarMedia.bucket, user.avatarMedia.variants, 'large', isPublic),
      };
    }

    const responseData = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarMediaId: user.avatarMediaId,
        avatarUrls: avatarUrls,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        timezonePreference: user.timezonePreference,
        timezone: user.timezone,
        locale: user.locale,
        dateFormat: user.dateFormat,
        timeFormat: user.timeFormat,
        phoneNumber: user.phoneNumber,
        phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
        onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      workspaces,
    };

    return reply.status(200).send(responseData);
  });

  // POST /me/onboarding/complete - Mark onboarding as completed
  app.post('/me/onboarding/complete', {
    schema: {
      tags: ['Auth'],
      summary: 'Complete onboarding',
      description: 'Marks the user onboarding as completed',
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
                hasCompletedOnboarding: { type: 'boolean' },
              },
            },
          },
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
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Check authentication
    if (!request.auth || !request.auth.tokenPayload) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userId = request.auth.tokenPayload.sub;

    // Update user onboarding status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompletedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        onboardingCompletedAt: true,
      },
    });

    logger.info({ userId }, 'User completed onboarding');

    return reply.status(200).send({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        hasCompletedOnboarding: !!updatedUser.onboardingCompletedAt,
      },
    });
  });

  // POST /auth/register - Register new user
  app.post('/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register new user',
      description: 'Creates a new user account with email and password',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 1 },
        },
        required: ['email', 'password', 'name'],
      },
      response: {
        201: {
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
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; password: string; name: string } }>, reply: FastifyReply) => {
    const { email, password, name } = request.body;

    try {
      // 1. Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'AUTH_USER_EXISTS',
            message: 'User with this email already exists',
          },
        });
      }

      // 2. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          name,
          emailVerified: new Date(), // Auto-verify for now
        },
      });

      // 4. Create session
      const tid = randomUUID();
      await sessionService.createSession({
        userId: user.id,
        tid,
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
      });

      // 5. Fetch workspace memberships for JWT
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
        select: { workspaceId: true, role: true },
      });
      const workspaces = memberships.map((m) => ({ id: m.workspaceId, role: m.role }));

      // 6. Generate tokens
      const accessToken = tokenService.signAccessToken({ 
        sub: user.id, 
        email: user.email,
        workspaces,
        hasCompletedOnboarding: !!user.onboardingCompletedAt,
      });
      const refreshToken = tokenService.signRefreshToken({ sub: user.id, tid });

      // 7. Set cookies
      setAuthCookies(reply, {
        accessToken,
        refreshToken,
      });

      logger.info({ userId: user.id, email }, 'User registered successfully');

      // 10. Return success response (new users always go to onboarding)
      return reply.status(201).send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        redirectTo: '/onboarding',
      });
    } catch (error) {
      logger.error({ error, email }, 'Error during registration');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during registration',
        },
      });
    }
  });

  // POST /auth/login - Login with email and password
  app.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      description: 'Authenticates user with email and password, returns access and refresh tokens',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
        required: ['email', 'password'],
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
  }, async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    try {
      // 1. Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user || !user.password) {
        logger.warn({ email }, 'Login attempt with invalid email');
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // 2. Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        logger.warn({ email, userId: user.id }, 'Login attempt with invalid password');
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // 3. Check if user has any workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        include: {
          workspace: true,
        },
      });

      // 4. Create session
      const tid = randomUUID();
      await sessionService.createSession({
        userId: user.id,
        tid,
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
      });

      // 5. Fetch workspace memberships for JWT
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
        select: { workspaceId: true, role: true },
      });
      const workspaces = memberships.map((m) => ({ id: m.workspaceId, role: m.role }));

      // 6. Generate tokens
      const accessToken = tokenService.signAccessToken({ 
        sub: user.id, 
        email: user.email,
        workspaces,
        hasCompletedOnboarding: !!user.onboardingCompletedAt,
      });
      const refreshToken = tokenService.signRefreshToken({ sub: user.id, tid });

      // 7. Set cookies
      setAuthCookies(reply, {
        accessToken,
        refreshToken,
      });

      logger.info({ userId: user.id, email }, 'User logged in successfully');

      // 7. Determine redirect path
      const redirectTo = workspaceMember 
        ? `/${workspaceMember.workspace.slug}/home`
        : '/onboarding';

      // 8. Return success response
      return reply.status(200).send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        redirectTo,
      });
    } catch (error) {
      logger.error({ error, email }, 'Error during login');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during login',
        },
      });
    }
  });

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
  }, async (request: FastifyRequest<{ Querystring: { code?: string; state?: string } }>, reply: FastifyReply) => {
    const { code, state } = request.query;

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

      // 4. Decode id_token
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

      if (!decoded || !decoded.email) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OAUTH_NO_EMAIL',
            message: 'No email found in Google profile',
          },
        });
      }

      // 5. Login or register user
      const result = await loginOrRegisterWithGoogle(decoded, {
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip ?? null,
      });

      // 6. Set cookies
      setAuthCookies(reply, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // 7. Return success response
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
      logger.error(
        {
          error,
          code,
        },
        'Error in Google OAuth callback'
      );

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
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

      // 7. Fetch workspace memberships for JWT
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, onboardingCompletedAt: true },
      });
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true, role: true },
      });
      const workspaces = memberships.map((m) => ({ id: m.workspaceId, role: m.role }));

      // 8. Generate new tokens
      const accessToken = tokenService.signAccessToken({ 
        sub: userId, 
        email: user!.email,
        workspaces,
        hasCompletedOnboarding: !!user!.onboardingCompletedAt,
      });
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

      // Generate magic link URL
      const magicLinkUrl = `${appUrlConfig.baseUrl}/auth/magic-link/verify?token=${result.token}`;

      // Send email stub
      await sendMagicLinkEmailStub({
        to: result.payload.email,
        magicLinkUrl,
      });

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
              type: 'object',
              properties: {
                id: { type: 'string' },
                slug: { type: 'string' },
                name: { type: 'string' },
              },
              required: ['id', 'slug', 'name'],
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

      // Determine redirectTo
      // Use payload redirectTo if it's a relative path (starts with /), otherwise use default
      let redirectTo: string;
      if (result.redirectTo && result.redirectTo.startsWith('/')) {
        redirectTo = result.redirectTo;
      } else {
        redirectTo = `/${result.workspace.slug}/dashboard`;
      }

      // Return success response
      return reply.status(200).send({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        workspace: {
          id: result.workspace.id,
          slug: result.workspace.slug,
          name: result.workspace.name,
        },
        redirectTo,
      });
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

