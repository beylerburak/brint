/**
 * Frontend Application Configuration
 * 
 * Centralized config for app-wide constants accessible to the frontend.
 * Only includes public values (no secrets).
 */

export type WebAppConfig = {
  appName: string;
  companyName: string;
  supportEmail: string;
};

export const WEB_APP_CONFIG: WebAppConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Bito",
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Beyler Interactive",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
};

