import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { env } from '../../config/env.js';
import type { GoogleProfile } from './google-oauth.service.js';
import { UnauthorizedError } from '../../lib/http-errors.js';

const GOOGLE_ISSUER = 'https://accounts.google.com';
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

// Create remote JWKS set for Google's public keys
const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

/**
 * Verifies a Google OAuth id_token using JWKS and validates issuer/audience
 * @param idToken - The Google OAuth id_token to verify
 * @returns Verified Google profile data
 * @throws UnauthorizedError if token verification fails
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID is not configured');
  }

  try {
    // Verify token signature, issuer, and audience
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUER,
      audience: clientId,
    });

    // Extract and validate required fields
    const sub = payload.sub;
    const email = payload.email;

    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedError(
        'OAUTH_INVALID_TOKEN',
        undefined,
        'Token missing required field: sub'
      );
    }

    if (!email || typeof email !== 'string') {
      throw new UnauthorizedError(
        'OAUTH_INVALID_TOKEN',
        undefined,
        'Token missing required field: email'
      );
    }

    // Build GoogleProfile from verified payload
    const profile: GoogleProfile = {
      sub,
      email,
      email_verified: typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      phone_number: typeof payload.phone_number === 'string' ? payload.phone_number : undefined,
    };

    return profile;
  } catch (error) {
    // Handle JWT verification errors
    if (error instanceof Error) {
      // Check if it's a JWT-specific error
      if (error.message.includes('signature') || error.message.includes('expired')) {
        throw new UnauthorizedError(
          'OAUTH_INVALID_TOKEN',
          undefined,
          'Google authentication failed: Invalid or expired token'
        );
      }
      if (error.message.includes('audience') || error.message.includes('issuer')) {
        throw new UnauthorizedError(
          'OAUTH_INVALID_TOKEN',
          undefined,
          'Google authentication failed: Token validation failed'
        );
      }
    }

    // Re-throw UnauthorizedError as-is
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    // Wrap other errors
    throw new UnauthorizedError(
      'OAUTH_VERIFICATION_FAILED',
      undefined,
      'Google authentication failed'
    );
  }
}

