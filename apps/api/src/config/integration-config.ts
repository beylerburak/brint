// apps/api/src/config/integration-config.ts

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

if (!clientId) {
  throw new Error('GOOGLE_DRIVE_CLIENT_ID environment variable is required');
}
if (!clientSecret) {
  throw new Error('GOOGLE_DRIVE_CLIENT_SECRET environment variable is required');
}
if (!redirectUri) {
  throw new Error('GOOGLE_DRIVE_REDIRECT_URI environment variable is required');
}

export const GOOGLE_DRIVE_CONFIG = {
  clientId,
  clientSecret,
  redirectUri,
  scope: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ].join(' '),
};
