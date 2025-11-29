// Context & Provider
export { AuthProvider, AuthContext, useAuth } from "./context/auth-context";

// Types
export type {
  AuthUser,
  AuthContextValue,
  Workspace,
  LoginResult,
  MagicLinkVerifyResult,
  LoginPayload,
  RefreshTokenResult,
  MagicLinkRequestResult,
  GoogleCallbackResult,
} from "./types";

// Hooks
export { useAuth as useAuthHook } from "./hooks";

// API
export {
  requestMagicLink,
  getGoogleOAuthUrl,
  completeGoogleOAuth,
  verifyMagicLink,
  refreshToken,
  logout,
  getCurrentSession,
} from "./api/auth-api";

// Components
export { LoginForm } from "./components/login-form";
export { LogoutButton } from "./components/logout-button";
export { LanguageSwitcher } from "./components/language-switcher";

