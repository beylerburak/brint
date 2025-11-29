import { describe, it, expect, beforeEach } from 'vitest';
import { tokenService, TokenError } from './token.service.js';
import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/index.js';

describe('TokenService', () => {
  describe('Access Token', () => {
    it('should sign access token with correct payload', () => {
      const payload = { sub: 'user123' };
      const token = tokenService.signAccessToken(payload);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Verify token can be decoded
      const decoded = jwt.decode(token) as any;
      expect(decoded).toHaveProperty('sub', 'user123');
      expect(decoded).toHaveProperty('type', 'access');
    });

    it('should sign access token with workspace ID', () => {
      const payload = { sub: 'user123', wid: 'workspace456' };
      const token = tokenService.signAccessToken(payload);

      const decoded = jwt.decode(token) as any;
      expect(decoded).toHaveProperty('sub', 'user123');
      expect(decoded).toHaveProperty('wid', 'workspace456');
      expect(decoded).toHaveProperty('type', 'access');
    });

    it('should verify valid access token', () => {
      const payload = { sub: 'user123', wid: 'workspace456' };
      const token = tokenService.signAccessToken(payload);

      const verified = tokenService.verifyAccessToken(token);
      expect(verified).toHaveProperty('sub', 'user123');
      expect(verified).toHaveProperty('wid', 'workspace456');
      expect(verified).toHaveProperty('type', 'access');
    });

    it('should throw TokenError for expired token', () => {
      // Create an expired token manually
      const expiredToken = jwt.sign(
        { sub: 'user123', type: 'access' },
        authConfig.accessToken.secret,
        { 
          issuer: authConfig.issuer,
          expiresIn: '-1h' // Expired 1 hour ago
        }
      );

      expect(() => {
        tokenService.verifyAccessToken(expiredToken);
      }).toThrow(TokenError);
    });

    it('should throw TokenError for invalid token', () => {
      expect(() => {
        tokenService.verifyAccessToken('invalid-token-string');
      }).toThrow(TokenError);
    });

    it('should throw TokenError for token with wrong type', () => {
      // Sign a refresh token but try to verify as access token
      const refreshToken = tokenService.signRefreshToken({
        sub: 'user123',
        tid: 'session456',
      });

      expect(() => {
        tokenService.verifyAccessToken(refreshToken);
      }).toThrow(TokenError);
    });

    it('should throw TokenError for token signed with wrong secret', () => {
      const wrongToken = jwt.sign(
        { sub: 'user123', type: 'access' },
        'wrong-secret',
        { issuer: authConfig.issuer }
      );

      expect(() => {
        tokenService.verifyAccessToken(wrongToken);
      }).toThrow(TokenError);
    });
  });

  describe('Refresh Token', () => {
    it('should sign refresh token with correct payload', () => {
      const payload = { sub: 'user123', tid: 'session456' };
      const token = tokenService.signRefreshToken(payload);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Verify token can be decoded
      const decoded = jwt.decode(token) as any;
      expect(decoded).toHaveProperty('sub', 'user123');
      expect(decoded).toHaveProperty('tid', 'session456');
      expect(decoded).toHaveProperty('type', 'refresh');
    });

    it('should verify valid refresh token', () => {
      const payload = { sub: 'user123', tid: 'session456' };
      const token = tokenService.signRefreshToken(payload);

      const verified = tokenService.verifyRefreshToken(token);
      expect(verified).toHaveProperty('sub', 'user123');
      expect(verified).toHaveProperty('tid', 'session456');
      expect(verified).toHaveProperty('type', 'refresh');
    });

    it('should throw TokenError for expired refresh token', () => {
      // Create an expired token manually
      const expiredToken = jwt.sign(
        { sub: 'user123', tid: 'session456', type: 'refresh' },
        authConfig.refreshToken.secret,
        { 
          issuer: authConfig.issuer,
          expiresIn: '-1d' // Expired 1 day ago
        }
      );

      expect(() => {
        tokenService.verifyRefreshToken(expiredToken);
      }).toThrow(TokenError);
    });

    it('should throw TokenError for invalid refresh token', () => {
      expect(() => {
        tokenService.verifyRefreshToken('invalid-token-string');
      }).toThrow(TokenError);
    });

    it('should throw TokenError for token with wrong type', () => {
      // Sign an access token but try to verify as refresh token
      const accessToken = tokenService.signAccessToken({
        sub: 'user123',
      });

      expect(() => {
        tokenService.verifyRefreshToken(accessToken);
      }).toThrow(TokenError);
    });

    it('should throw TokenError for refresh token signed with wrong secret', () => {
      const wrongToken = jwt.sign(
        { sub: 'user123', tid: 'session456', type: 'refresh' },
        'wrong-secret',
        { issuer: authConfig.issuer }
      );

      expect(() => {
        tokenService.verifyRefreshToken(wrongToken);
      }).toThrow(TokenError);
    });
  });
});
