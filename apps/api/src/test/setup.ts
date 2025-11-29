// Test environment setup
// IMPORTANT: This file must set all environment variables BEFORE env.ts is imported
// Set NODE_ENV first to enable test-specific behavior in env.ts
process.env.NODE_ENV = 'test';

// Set minimal required env vars for tests (can be overridden in individual tests)
if (!process.env.API_PORT) {
  process.env.API_PORT = '3000';
}

if (!process.env.API_HOST) {
  process.env.API_HOST = '0.0.0.0';
}

if (!process.env.API_LOG_LEVEL) {
  process.env.API_LOG_LEVEL = 'info';
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
}

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}

if (!process.env.ACCESS_TOKEN_SECRET) {
  process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret-min-32-chars-long';
}

if (!process.env.REFRESH_TOKEN_SECRET) {
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-min-32-chars-long';
}

if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
}

if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
}

if (!process.env.GOOGLE_OAUTH_REDIRECT_URI) {
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
}

if (!process.env.APP_URL) {
  process.env.APP_URL = 'http://localhost:3000';
}

if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = 'http://localhost:3001';
}

if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = 'us-east-1';
}

if (!process.env.S3_MEDIA_BUCKET) {
  process.env.S3_MEDIA_BUCKET = 'test-bucket';
}

