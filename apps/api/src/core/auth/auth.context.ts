import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tokenService, type AccessTokenPayload } from './token.service.js';

/**
 * Auth context that is attached to each request
 * null if the request is public (no valid auth)
 */
export type AuthContext = {
  userId: string;
  workspaceId?: string;
  brandId?: string;
  tokenType: 'access';
  rawAccessToken: string;
  tokenPayload: AccessTokenPayload & {
    iat?: number;
    exp?: number;
  };
} | null;

// Augment FastifyRequest to include auth context
declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

/**
 * Auth context middleware plugin
 * 
 * Extracts and validates JWT token from Authorization header,
 * reads workspace/brand context from X-Workspace-Id and X-Brand-Id headers,
 * and attaches auth context to request.auth
 * 
 * Does NOT enforce authentication - endpoints remain public by default.
 * Permission checks and auth requirements will be handled in TS-21+.
 */
export default fp(async function authContextPlugin(app: FastifyInstance) {
  // Initialize auth context for all requests
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Default to null (public request)
    request.auth = null;

    let token: string | undefined;

    // Try to get token from Authorization header first
    const authHeader = request.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      // Parse Bearer token
      const [scheme, headerToken] = authHeader.split(' ');
      if (headerToken && scheme.toLowerCase() === 'bearer') {
        token = headerToken;
      }
    }

    // If no header token, try to get from cookie
    if (!token) {
      token = request.cookies?.access_token;
    }

    // No token found - request remains public
    if (!token) {
      return;
    }

    try {
      // Verify and decode token
      const payload = tokenService.verifyAccessToken(token);

      // Extract workspace and brand from headers
      const workspaceIdHeader = request.headers['x-workspace-id'];
      const brandIdHeader = request.headers['x-brand-id'];

      const workspaceId =
        typeof workspaceIdHeader === 'string' && workspaceIdHeader.length > 0
          ? workspaceIdHeader
          : undefined;

      const brandId =
        typeof brandIdHeader === 'string' && brandIdHeader.length > 0
          ? brandIdHeader
          : undefined;

      // Attach auth context to request
      request.auth = {
        userId: payload.sub,
        workspaceId,
        brandId,
        tokenType: 'access',
        rawAccessToken: token,
        tokenPayload: payload as AccessTokenPayload & {
          iat?: number;
          exp?: number;
        },
      };
    } catch (err) {
      // Invalid/expired token - clear cookies and log
      request.log.warn({ err }, 'Failed to verify access token - clearing cookies');
      
      // Clear invalid cookies
      reply.clearCookie('access_token', { path: '/' });
      reply.clearCookie('refresh_token', { path: '/' });
      
      request.auth = null;
    }
  });

  // Log auth context in response hook for debugging/monitoring
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth) {
      request.log.info(
        {
          userId: request.auth.userId,
          workspaceId: request.auth.workspaceId,
          brandId: request.auth.brandId,
        },
        'Auth context onResponse'
      );
    }
  });
});

