import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/index.js';
import type { WorkspaceRole } from '@prisma/client';

export type WorkspaceClaim = {
  id: string;
  role: WorkspaceRole;
};

export type AccessTokenPayload = {
  sub: string; // userId
  email: string;
  workspaces: WorkspaceClaim[];
  hasCompletedOnboarding: boolean;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string; // userId
  tid: string; // refresh token id (revocation için)
  type: 'refresh';
};

class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

export const tokenService = {
  signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
    const fullPayload: AccessTokenPayload = {
      ...payload,
      type: 'access',
    };

    return jwt.sign(fullPayload, authConfig.accessToken.secret, {
      issuer: authConfig.issuer,
      expiresIn: `${authConfig.accessToken.expiresInMinutes}m`,
    } as jwt.SignOptions);
  },

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, authConfig.accessToken.secret, {
        issuer: authConfig.issuer,
      }) as AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw new TokenError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid token');
      }
      throw error;
    }
  },

  signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
    const fullPayload: RefreshTokenPayload = {
      ...payload,
      type: 'refresh',
    };

    return jwt.sign(fullPayload, authConfig.refreshToken.secret, {
      issuer: authConfig.issuer,
      expiresIn: `${authConfig.refreshToken.expiresInDays}d`,
    } as jwt.SignOptions);
  },

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, authConfig.refreshToken.secret, {
        issuer: authConfig.issuer,
      }) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new TokenError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid token');
      }
      throw error;
    }
  },
};

