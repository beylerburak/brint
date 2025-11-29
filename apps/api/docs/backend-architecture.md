# Backend Architecture

> This document defines the backend architecture decisions for the Brint API. It serves as the authoritative reference for AI assistants and developers working on the backend.

## Table of Contents

1. [General Structure](#general-structure)
2. [Config Layer](#config-layer)
3. [Logger](#logger)
4. [HTTP Layer](#http-layer)
5. [Auth & Claims Pipeline](#auth--claims-pipeline)
6. [Events / Background Tasks](#events--background-tasks)
7. [Module Structure](#module-structure)
8. [Development Standards](#development-standards)

---

## General Structure

The backend is built on **Node.js + Fastify** and follows a **domain-driven module structure** with clear separation of concerns.

### Technology Stack

- **Runtime**: Node.js (ESM modules)
- **Framework**: Fastify
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache**: Redis
- **Logging**: Pino
- **Validation**: Zod (see [Validation Standard Guide](../../../docs/guides-for-ai/validation-standard.md))
- **Testing**: Vitest (spec files)

### Directory Structure

```
apps/api/
├── src/
│   ├── config/          # Configuration layer (env → config)
│   ├── core/            # Core infrastructure
│   │   ├── auth/        # Auth, tokens, sessions, permissions
│   │   └── http/        # Server setup
│   ├── lib/             # Shared utilities
│   │   ├── logger.ts
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   └── error-handler.ts
│   ├── modules/         # Domain modules
│   │   ├── auth/
│   │   ├── brand/
│   │   ├── user/
│   │   ├── workspace/
│   │   ├── health/
│   │   ├── debug/
│   │   └── studio/
│   └── plugins/         # Fastify plugins
│       ├── swagger.ts
│       └── cookie.ts
├── prisma/              # Database schema and migrations
└── docs/                # Documentation
```

### Layer Architecture

The backend follows a layered architecture:

1. **Routes (Controllers)**: HTTP request/response handling
   - Located in `modules/*/routes.ts` files
   - Register routes with Fastify
   - Use `preHandler` for middleware (auth, permissions)
   - Define Swagger schemas

2. **Services**: Business logic and domain operations
   - Located in `modules/*/service.ts` files
   - Domain services (e.g., `brand-studio.service.ts`)
   - Application services (e.g., `magic-link.service.ts`)
   - No direct database access (use repositories)

3. **Repositories**: Data access layer
   - Located in `modules/*/repository.ts` files
   - Prisma queries
   - Convert Prisma models to domain entities
   - Handle database errors

4. **Entities**: Domain models with business rules
   - Located in `modules/*/entity.ts` files
   - Pure TypeScript classes
   - Validation and invariants
   - `toJSON()` and `fromPrisma()` methods

5. **Core**: Infrastructure and cross-cutting concerns
   - `core/auth/`: Token service, session service, permission service, auth context
   - `core/http/`: Server setup, error handlers
   - `lib/`: Logger, Prisma client, Redis client

---

## Config Layer

### Environment Management

All configuration follows the pattern: **env → config → code**

1. **Environment Variables** (`src/config/env.ts`)
   - Zod schema validation
   - Type-safe environment parsing
   - Fails fast on missing/invalid env vars
   - Loads `.env` from project root

2. **Config Objects** (`src/config/index.ts`)
   - Maps env vars to application config
   - Grouped by domain: `appConfig`, `dbConfig`, `cacheConfig`, `authConfig`, `oauthConfig`
   - No direct `process.env` access in application code

### Example

```typescript
// ❌ FORBIDDEN: Direct env access
const port = process.env.API_PORT;

// ✅ CORRECT: Use config
import { appConfig } from '@/config';
const port = appConfig.port;
```

### Runtime vs Build-Time

- **Runtime**: All config is loaded at server startup
- **Build-Time**: No build-time config needed (pure Node.js runtime)

---

## Logger

### Pino Integration

The backend uses **Pino** for structured logging.

**Location**: `src/lib/logger.ts`

```typescript
import { logger } from '@/lib/logger';

logger.info({ userId, workspaceId }, 'User accessed workspace');
logger.error({ err, method, url }, 'Request failed');
```

### Logging Patterns

1. **Request/Response Logging**
   - Automatic via Fastify logger (configured with Pino)
   - Logs method, path, status, duration

2. **Error Logging**
   - Global error handler logs all errors
   - Includes stack traces in development
   - Structured context (userId, workspaceId, etc.)

3. **Structured Logging**
   - Always use object context: `logger.info({ key: value }, 'message')`
   - Never string interpolation: `logger.info('User ${id} logged in')` ❌

### Log Levels

Configured via `API_LOG_LEVEL` env var:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: Info, warnings, errors (default)
- `debug`: All logs

---

## HTTP Layer

### Server Setup

**Location**: `src/core/http/server.ts`

The server is created via `createServer()` function:

1. Creates Fastify instance with Pino logger
2. Registers global error handler
3. Registers 404 handler
4. Registers plugins (Swagger, Cookie, Auth Context)
5. Registers module routes

### Global Error Handler

**Location**: `src/lib/error-handler.ts`

All errors are caught and returned in standardized format:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Error message",
    "details": "Stack trace (dev only)"
  }
}
```

Error codes:
- `NOT_FOUND`: 404 errors
- `UNAUTHORIZED`: 401 errors (from auth/permission middleware)
- `FORBIDDEN`: 403 errors (from permission middleware)
- `INTERNAL_SERVER_ERROR`: 500 errors

### Global Response Format

**Success Response**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

### Swagger Setup

**Location**: `src/plugins/swagger.ts`

- OpenAPI 3.0 specification
- Swagger UI at `/docs`
- Schema definitions in route handlers
- Auto-generated from Fastify route schemas

**Example Route Schema**:
```typescript
app.get('/brands', {
  schema: {
    tags: ['Studio'],
    summary: 'Get accessible brands',
    response: {
      200: { /* schema */ },
      401: { /* schema */ },
      403: { /* schema */ },
    },
  },
}, handler);
```

---

## Auth & Claims Pipeline

### Token Service

**Location**: `src/core/auth/token.service.ts`

Handles JWT creation and verification:

- **Access Tokens**: Short-lived (15 minutes default)
  - Payload: `{ sub: userId, wid?: workspaceId, bid?: brandId, type: 'access' }`
  - Signed with `ACCESS_TOKEN_SECRET`

- **Refresh Tokens**: Long-lived (30 days default)
  - Payload: `{ sub: userId, tid: sessionId, type: 'refresh' }`
  - Signed with `REFRESH_TOKEN_SECRET`
  - `tid` maps to `Session.id` in database

### Session Service

**Location**: `src/core/auth/session.service.ts`

Manages user sessions in database:

- `createSession()`: Creates session with `tid` (refresh token ID)
- `revokeSession(tid)`: Deletes session (logout)
- `revokeAllUserSessions(userId)`: Logout from all devices
- `touchSession(tid)`: Updates `lastActiveAt`

Session model:
- `id`: Matches refresh token `tid`
- `userId`: User reference
- `expiresAt`: Session expiration
- `userAgent`, `ipAddress`: Metadata
- `lastActiveAt`: Last activity timestamp

### Auth Context

**Location**: `src/core/auth/auth.context.ts`

Fastify plugin that populates `request.auth` for all requests:

1. Extracts `Authorization: Bearer <token>` header
2. Verifies access token
3. Extracts `X-Workspace-Id` and `X-Brand-Id` headers
4. Attaches `AuthContext` to `request.auth`

**AuthContext Type**:
```typescript
type AuthContext = {
  userId: string;
  workspaceId?: string;
  brandId?: string;
  tokenType: 'access';
  rawAccessToken: string;
  tokenPayload: AccessTokenPayload;
} | null;
```

**Important**: Auth context does NOT enforce authentication. Routes remain public by default. Use `requirePermission()` to protect routes.

### Permission Service

**Location**: `src/core/auth/permission.service.ts`

Resolves effective permissions for user + workspace:

1. Finds `WorkspaceMember` for userId + workspaceId
2. Maps `WorkspaceMember.role` to `Role.key`
3. Queries `Role` → `RolePermission` → `Permission`
4. Returns validated `PermissionKey[]`

**Methods**:
- `getEffectivePermissionsForUserWorkspace()`: Returns all permissions
- `hasPermission()`: Checks single permission

### Permissions Registry

**Location**: `src/core/auth/permissions.registry.ts`

Central registry for all permission keys:

```typescript
export const PERMISSIONS = {
  WORKSPACE_SETTINGS_VIEW: 'workspace:settings.view',
  WORKSPACE_MEMBERS_MANAGE: 'workspace:members.manage',
  STUDIO_BRAND_VIEW: 'studio:brand.view',
  STUDIO_BRAND_CREATE: 'studio:brand.create',
  STUDIO_CONTENT_CREATE: 'studio:content.create',
  STUDIO_CONTENT_PUBLISH: 'studio:content.publish',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
```

**Permission Key Format**: `<scope>:<resource>.<action>`
- `workspace:*`: Workspace-level permissions
- `studio:*`: Brand Studio permissions

### requirePermission Middleware

**Location**: `src/core/auth/require-permission.ts`

Reusable permission guard for routes:

```typescript
app.get('/protected', {
  preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
}, handler);
```

**Behavior**:
1. Checks `request.auth` exists (401 if not)
2. Checks `request.auth.workspaceId` exists (401 if not)
3. Calls `permissionService.hasPermission()`
4. Returns 403 if permission missing
5. Continues to handler if permission granted

---

## Events / Background Tasks

### Current State

- **Event Emitter**: Not yet implemented
- **Job Queue**: Not yet implemented (future: BullMQ/Agenda)

### Future Placeholders

When implementing events/background tasks:

1. **Event Emitter**: Use Node.js `EventEmitter` or `eventemitter3`
2. **Brand Events**: Example events after TS-22:
   - `brand.created`
   - `brand.updated`
   - `brand.deleted`
3. **Job Queue**: For async tasks (email sending, image processing, etc.)

---

## Module Structure

### Example: Brand Module

```
modules/brand/
├── brand.entity.ts          # Domain entity with validation
├── brand.repository.ts      # Prisma data access
├── brand-studio.service.ts  # Domain service (brand access logic)
└── brand-studio.service.spec.ts  # Tests
```

**Entity** (`brand.entity.ts`):
- Pure TypeScript class
- Business rules (slug normalization, validation)
- `create()`, `fromPrisma()`, `toJSON()` methods

**Repository** (`brand.repository.ts`):
- Prisma queries
- Converts Prisma models to entities
- Handles unique constraint violations

**Service** (`brand-studio.service.ts`):
- Business logic (which brands are accessible)
- Uses `permissionService` and `brandRepository`
- No direct database access

**Routes** (`studio.routes.ts`):
- HTTP handlers
- Uses `requirePermission()` middleware
- Swagger schema definitions
- Calls services (not repositories)

### Module Pattern

1. **Entity**: Domain model with invariants
2. **Repository**: Data access (Prisma → Entity)
3. **Service**: Business logic (uses Repository + Permission Service)
4. **Routes**: HTTP layer (uses Service, requires Permission)

---

## Development Standards

### File Naming

- **Entities**: `*.entity.ts`
- **Repositories**: `*.repository.ts`
- **Services**: `*.service.ts` or `*-studio.service.ts` (domain services)
- **Routes**: `*.routes.ts`
- **Tests**: `*.spec.ts` (same directory as source)

### Absolute Imports

Use `@/` alias for `src/`:

```typescript
// ✅ CORRECT
import { logger } from '@/lib/logger';
import { appConfig } from '@/config';

// ❌ FORBIDDEN: Relative imports
import { logger } from '../../lib/logger';
```

### Test Patterns

- **Unit Tests**: Test entities, services, repositories in isolation
- **Integration Tests**: Test routes with test database
- **Location**: `*.spec.ts` files next to source files
- **Framework**: Vitest

### Tiny Step Discipline

- Each feature is a Tiny Step (TS-XX)
- Complete one TS before starting another
- Test criteria must be met before TS is considered complete
- See `docs/tiny-steps.md` for TS definitions

### Code Organization Rules

1. **No Hardcoded Values**: Use config layer
2. **No Magic Strings**: Use constants/registry (e.g., `PERMISSIONS`)
3. **No Direct Env Access**: Use `config/index.ts`
4. **No Direct DB Access in Services**: Use repositories
5. **No Business Logic in Routes**: Use services

---

## Summary

The backend follows a **layered, domain-driven architecture**:

- **Config Layer**: env → config → code (no hardcoded values)
- **Logger**: Pino with structured logging
- **HTTP Layer**: Fastify with global error handling and Swagger
- **Auth Pipeline**: Token → Session → Auth Context → Permission Check
- **Module Pattern**: Entity → Repository → Service → Routes
- **Development**: Absolute imports, test files, Tiny Step discipline

All code must follow these patterns. When in doubt, refer to existing modules (e.g., `brand/`) as examples.

