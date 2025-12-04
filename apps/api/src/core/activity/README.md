# Activity Log System

Global event/activity logging system for the entire application.

## Overview

The ActivityLog system provides a single table to track all important events across different domains (brands, content, publications, media, etc.). This eliminates the need for domain-specific event tables and provides a unified audit trail.

## Database Schema

### Enums

**ActivityEntityType**: Type of entity being logged
- `WORKSPACE`, `BRAND`, `SOCIAL_ACCOUNT`, `CONTENT`, `PUBLICATION`, `MEDIA`, `USER`, `SETTINGS`, `OTHER`

**ActivityActorType**: Who/what performed the action
- `USER` - Panel user
- `SYSTEM` - Application's automatic processes
- `WORKER` - Queue workers (BullMQ)
- `INTEGRATION` - External services (Meta API, Google Ads, etc.)

**ActivityVisibility**: Who can see this log
- `INTERNAL` - Only internal screens
- `CLIENT` - Client can also see
- `SYSTEM` - Debug/log only, may not be shown in UI

**ActivitySeverity**: Log severity
- `INFO`, `WARNING`, `ERROR`

### ActivityLog Model

```prisma
model ActivityLog {
  id          String @id @default(cuid())
  workspaceId String
  brandId     String?
  
  entityType  ActivityEntityType
  entityId    String
  eventKey    String
  message     String?
  context     String?
  
  actorType   ActivityActorType
  actorUserId String?
  actorLabel  String?
  
  payload     Json?
  visibility  ActivityVisibility @default(INTERNAL)
  severity    ActivitySeverity   @default(INFO)
  
  createdAt   DateTime @default(now())
  
  workspace   Workspace @relation(...)
  brand       Brand?    @relation(...)
}
```

### Indexes

- `[workspaceId, createdAt]` - Workspace timeline
- `[brandId, createdAt]` - Brand timeline
- `[entityType, entityId, createdAt]` - Entity-specific timeline
- `[eventKey, createdAt]` - Event type queries

## Usage

### Basic Usage

```typescript
import { logActivity, buildBrandActivity } from '@/core/activity/activity-log.service';
import { ActivityActorType } from '@prisma/client';

await logActivity(
  buildBrandActivity({
    workspaceId: 'workspace_id',
    brandId: 'brand_id',
    entityId: 'brand_id',
    eventKey: 'brand.created',
    message: 'Brand created: Nike',
    actorType: ActivityActorType.USER,
    actorUserId: 'user_id',
    payload: { name: 'Nike', slug: 'nike' },
  })
);
```

### Domain Helpers

Pre-built helpers for common entity types:

```typescript
// Brand activities
buildBrandActivity({ ... })

// Content activities
buildContentActivity({ ... })

// Publication activities
buildPublicationActivity({ ... })

// Media activities
buildMediaActivity({ ... })

// Workspace activities
buildWorkspaceActivity({ ... })

// User activities
buildUserActivity({ ... })
```

### Event Key Naming Convention

Use namespaced format: `{domain}.{action}`

**Examples:**
- `brand.created`, `brand.updated`, `brand.deleted`
- `content.created`, `content.scheduled`, `content.published`
- `publication.started`, `publication.completed`, `publication.failed`
- `social_account.connected`, `social_account.token_refreshed`
- `media.uploaded`, `media.processed`, `media.deleted`

### Actor Types

**USER Actions:**
```typescript
actorType: ActivityActorType.USER,
actorUserId: request.auth.userId,
```

**SYSTEM Actions:**
```typescript
actorType: ActivityActorType.SYSTEM,
actorLabel: 'Scheduler',
```

**WORKER Actions:**
```typescript
actorType: ActivityActorType.WORKER,
actorLabel: 'Instagram Worker',
```

**INTEGRATION Actions:**
```typescript
actorType: ActivityActorType.INTEGRATION,
actorLabel: 'Meta API',
```

### Visibility Levels

**INTERNAL** (default):
- Only visible to workspace admins
- Most common for internal operations

**CLIENT:**
- Visible to brand clients
- Use for client-facing changes

**SYSTEM:**
- Debug/monitoring only
- Not shown in regular UI

### Error Handling

By default, activity logging errors are swallowed to prevent disrupting main business logic:

```typescript
// Default: swallowErrors = true
await logActivity({ ... }); // Won't throw on error

// Explicit: throw on error
await logActivity({ ... }, { swallowErrors: false }); // Will throw
```

## Examples

### Brand Created
```typescript
await logActivity(
  buildBrandActivity({
    workspaceId,
    brandId,
    entityId: brandId,
    eventKey: 'brand.created',
    message: `Brand created: ${name}`,
    actorType: ActivityActorType.USER,
    actorUserId: userId,
    payload: { name, slug, industry },
  })
);
```

### Content Scheduled
```typescript
await logActivity(
  buildContentActivity({
    workspaceId,
    brandId,
    entityId: contentId,
    eventKey: 'content.scheduled',
    message: 'Content scheduled for publication',
    actorType: ActivityActorType.SYSTEM,
    actorLabel: 'Scheduler',
    context: 'scheduler',
    payload: { scheduledAt, platforms: ['instagram', 'facebook'] },
  })
);
```

### Publication Failed
```typescript
await logActivity(
  buildPublicationActivity({
    workspaceId,
    brandId,
    entityId: publicationId,
    eventKey: 'publication.failed',
    message: `Publication failed for Instagram`,
    actorType: ActivityActorType.WORKER,
    actorLabel: 'Instagram Worker',
    context: 'publication_worker',
    severity: ActivitySeverity.ERROR,
    payload: { platform: 'instagram', errorCode: 'RATE_LIMIT', errorMessage: 'Rate limit exceeded' },
  })
);
```

### Integration Event
```typescript
await logActivity({
  workspaceId,
  brandId,
  entityType: ActivityEntityType.SOCIAL_ACCOUNT,
  entityId: accountId,
  eventKey: 'social_account.token_refreshed',
  message: 'Access token refreshed successfully',
  actorType: ActivityActorType.INTEGRATION,
  actorLabel: 'Meta API',
  context: 'oauth_refresh',
  payload: { expiresAt: new Date().toISOString() },
});
```

## Querying Activity Logs

### Get timeline for a specific brand
```typescript
const timeline = await prisma.activityLog.findMany({
  where: { brandId },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

### Get timeline for any entity
```typescript
const timeline = await prisma.activityLog.findMany({
  where: {
    entityType: ActivityEntityType.CONTENT,
    entityId: contentId,
  },
  orderBy: { createdAt: 'desc' },
});
```

### Get workspace activity feed
```typescript
const feed = await prisma.activityLog.findMany({
  where: {
    workspaceId,
    visibility: { in: [ActivityVisibility.INTERNAL, ActivityVisibility.CLIENT] },
  },
  orderBy: { createdAt: 'desc' },
  take: 100,
});
```

## Future Enhancements

- [ ] Activity log viewer UI component
- [ ] Real-time activity feed (WebSocket)
- [ ] Activity log retention policy
- [ ] Bulk activity logging
- [ ] Activity log export (CSV/JSON)
- [ ] Activity log search/filtering API

