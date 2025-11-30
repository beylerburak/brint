# Publication Domain

## Overview

The Publication domain handles social media content publishing for Instagram and Facebook platforms. It provides a queue-based, multi-tenant architecture that supports immediate and scheduled publishing with proper RBAC controls.

## Domain Model

### Publication Model

```prisma
model Publication {
  id                   String                 @id @default(cuid())
  workspaceId          String
  brandId              String
  contentId            String?                // Optional - null for direct social publishing
  socialAccountId      String?                // Which social account to publish to
  platform             PublicationPlatform    // instagram, facebook
  contentType          PublicationContentType // image, video, carousel, reel, link
  scheduledAt          DateTime?
  publishedAt          DateTime?
  failedAt             DateTime?
  status               PublicationStatus      // scheduled, publishing, published, failed, cancelled
  caption              String?                // Unified caption/message field
  permalink            String?                // Platform's URL for the published post
  payloadJson          Json?                  // Structured payload for publishing
  providerResponseJson Json?                  // Full provider response
  externalPostId       String?                // Provider's post ID
  jobId                String?                // BullMQ job ID
  clientRequestId      String?                // Client-provided idempotency key
  createdAt            DateTime
  updatedAt            DateTime
}
```

### Supported Platforms & Content Types

| Platform  | Content Type | Description |
|-----------|--------------|-------------|
| Instagram | IMAGE        | Single image post |
| Instagram | CAROUSEL     | Multi-image/video carousel (2-10 items) |
| Instagram | REEL         | Short video content |
| Facebook  | PHOTO        | Single photo post to Page |
| Facebook  | VIDEO        | Video post to Page |
| Facebook  | LINK         | Link share with optional message |

### Publication Status Flow

```
SCHEDULED → PUBLISHING → PUBLISHED
                      ↘ FAILED
         
SCHEDULED → CANCELLED (user cancellation)
```

## API Endpoints

### Instagram Publishing

```
POST /v1/brands/:brandId/publications/instagram
```

**Request Body:**
```json
{
  "socialAccountId": "cuid",
  "publishAt": "2024-01-01T12:00:00Z",  // optional
  "clientRequestId": "uuid",              // optional, for idempotency
  "payload": {
    "contentType": "IMAGE" | "CAROUSEL" | "REEL",
    // IMAGE:
    "imageMediaId": "cuid",
    "caption": "...",
    "altText": "...",
    "locationId": "...",
    "userTags": [{ "igUserId": "...", "x": 0.5, "y": 0.5 }],
    // CAROUSEL:
    "items": [{ "mediaId": "cuid", "type": "IMAGE" | "VIDEO", "altText": "..." }],
    // REEL:
    "videoMediaId": "cuid",
    "coverMediaId": "cuid",
    "shareToFeed": true,
    "thumbOffsetSeconds": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "status": "scheduled",
    "scheduledAt": "2024-01-01T12:00:00Z"
  }
}
```

### Facebook Publishing

```
POST /v1/brands/:brandId/publications/facebook
```

**Request Body:**
```json
{
  "socialAccountId": "cuid",
  "publishAt": "2024-01-01T12:00:00Z",
  "clientRequestId": "uuid",
  "payload": {
    "contentType": "PHOTO" | "VIDEO" | "LINK",
    // PHOTO:
    "imageMediaId": "cuid",
    "message": "...",
    "altText": "...",
    // VIDEO:
    "videoMediaId": "cuid",
    "title": "...",
    "thumbMediaId": "cuid",
    // LINK:
    "linkUrl": "https://example.com",
    "message": "..."
  }
}
```

### List Publications

```
GET /v1/brands/:brandId/publications
GET /v1/brands/:brandId/publications/:publicationId
```

## Queue Architecture

### Queue Names

- `instagram-publish` - Instagram publishing jobs
- `facebook-publish` - Facebook publishing jobs

### Job Data

```typescript
interface PublishJobData {
  publicationId: string;
  workspaceId: string;
  brandId: string;
}
```

### Job Options

- **Attempts:** 3 with exponential backoff (5s, 10s, 20s)
- **Delay:** Calculated from `publishAt` for scheduled posts
- **Retention:** Last 100 completed jobs for 24 hours; failed jobs kept

### Worker Concurrency

Each worker processes up to 3 jobs concurrently.

## Graph API Integration

### Instagram Content API Flow

1. **IMAGE:**
   - `POST /{ig-user-id}/media` with `image_url`, `caption`
   - `POST /{ig-user-id}/media_publish` with `creation_id`
   - `GET /{media-id}?fields=permalink`

2. **CAROUSEL:**
   - Create child containers with `is_carousel_item=true`
   - Create parent container with `children=<comma-separated-ids>`
   - Publish and get permalink

3. **REEL:**
   - `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url`
   - Wait for video processing
   - Publish and get permalink

### Facebook Page API Flow

1. **PHOTO:**
   - `POST /{page-id}/photos` with `url`, `caption`
   - `GET /{photo-id}?fields=link`

2. **VIDEO:**
   - `POST /{page-id}/videos` with `file_url`, `description`, `title`
   - `GET /{video-id}?fields=permalink_url`

3. **LINK:**
   - `POST /{page-id}/feed` with `link`, `message`
   - `GET /{post-id}?fields=permalink_url`

## Activity Events

| Event Type | Trigger | Scope |
|------------|---------|-------|
| `publication.scheduled` | Publication created | publication |
| `publication.published` | Publishing succeeded | publication |
| `publication.failed` | Publishing failed | publication |
| `publication.updated` | Publication modified | publication |
| `publication.cancelled` | Publication cancelled | publication |

## Permissions

- `studio:content.publish` - Required to create publications
- `studio:content.view` - Required to list/view publications

## Validation Schemas

All payloads are validated using Zod schemas from `@brint/core-validation`:

- `createInstagramPublicationSchema`
- `createFacebookPublicationSchema`
- `instagramPublicationPayloadSchema` (discriminated union)
- `facebookPublicationPayloadSchema` (discriminated union)

## Error Codes

| Code | Description |
|------|-------------|
| `SOCIAL_ACCOUNT_NOT_FOUND` | Social account doesn't exist |
| `SOCIAL_ACCOUNT_BRAND_MISMATCH` | Account doesn't belong to brand |
| `SOCIAL_ACCOUNT_PLATFORM_MISMATCH` | Wrong platform for endpoint |
| `SOCIAL_ACCOUNT_NOT_ACTIVE` | Account is disconnected/removed |
| `PUBLICATION_NOT_FOUND` | Publication doesn't exist |
| `WORKSPACE_MISMATCH` | Header doesn't match brand's workspace |

## Future Platform Support

The architecture is designed to support additional platforms:

- **TikTok** - Video content publishing
- **YouTube** - Video uploads and Shorts
- **X (Twitter)** - Tweets with media
- **Pinterest** - Pin creation
- **LinkedIn** - Page posts

Each platform would follow the same pattern:
1. Add payload schemas to `@brint/core-validation`
2. Create endpoint in `publication.routes.ts`
3. Create queue and worker in `core/queue/workers/`
4. Map content types in `publication.types.ts`

## Credentials Management

Social account credentials are stored encrypted using AES-256-GCM in `socialAccount.credentialsEncrypted`. The worker decrypts them at publish time using `decryptSocialCredentials()`.

### Instagram Credentials Structure

```typescript
{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  igBusinessAccountId?: string;
}
```

### Facebook Credentials Structure

```typescript
{
  accessToken: string;
  pageId?: string;
  refreshToken?: string;
  expiresAt?: string;
}
```

## Media URL Requirements

Graph API requires publicly accessible URLs for media. The system uses:

1. CDN URL via `S3_PUBLIC_CDN_URL` environment variable
2. Media must have `isPublic: true` in the Media table

If CDN is not configured, publishing will fail with an appropriate error.

