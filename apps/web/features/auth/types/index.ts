/**
 * Core authentication user type
 */
export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  googleId?: string | null;
};

/**
 * Workspace with optional subscription and permissions
 */
export interface Workspace {
  id: string;
  slug: string;
  name?: string;
  subscription?: {
    plan: string;
    status: string;
    renewsAt: string | null;
  } | null;
  permissions?: string[];
}

/**
 * Result of a successful login operation
 */
export interface LoginResult {
  user: AuthUser;
  workspaces: Workspace[];
  accessToken: string;
  refreshToken?: string;
}

/**
 * Result of magic link verification
 */
export interface MagicLinkVerifyResult {
  success: boolean;
  user: AuthUser;
  workspace: Workspace | null;
  ownerWorkspaces: Array<Workspace & { updatedAt: string }>;
  memberWorkspaces: Array<Workspace & { updatedAt: string }>;
  redirectTo: string | null;
  invites?: Array<{ id: string; updatedAt?: string | null }>;
}

/**
 * Authentication context value exposed to consumers
 */
export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  accessToken: string | null;
  tokenReady: boolean;
  login: (result: LoginResult) => Promise<void>;
  loginWithSession: (result: LoginResult) => Promise<void>;
  logout: () => Promise<void>;
  verifyMagicLinkToken: (token: string) => Promise<LoginResult & { verifyData?: MagicLinkVerifyResult }>;
}

/**
 * Payload for login requests
 */
export interface LoginPayload {
  email: string;
  password?: string;
}

/**
 * Result of token refresh
 */
export interface RefreshTokenResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Result of magic link request
 */
export interface MagicLinkRequestResult {
  success: boolean;
  message: string;
}

/**
 * Result of Google OAuth callback
 */
export interface GoogleCallbackResult {
  user: { id: string; email: string; name?: string | null };
  redirectTo: string;
}

