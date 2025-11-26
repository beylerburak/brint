import { randomBytes } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { redis } from '../../lib/redis.js';
import { oauthConfig } from '../../config/index.js';
import { loginOrRegisterWithGoogle, type GoogleProfile } from './google-oauth.service.js';
import { setAuthCookies } from '../../core/auth/auth.cookies.js';
import { logger } from '../../lib/logger.js';

/**
 * Registers authentication routes
 * - GET /auth/google - Generate Google OAuth URL
 * - GET /auth/google/callback - Handle Google OAuth callback
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
}

