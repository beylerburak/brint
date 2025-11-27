# Auth, Claims & i18n

> This document defines the authentication, authorization (claims), role-permission model, and internationalization (i18n) rules for the Brint application. It serves as the authoritative reference for both backend and frontend development.

## Table of Contents

1. [Auth Model](#auth-model)
2. [Claims Model](#claims-model)
3. [Permission Model](#permission-model)
4. [i18n Rules](#i18n-rules)
5. [Protected Flow (Backend)](#protected-flow-backend)
6. [Protected Flow (Frontend)](#protected-flow-frontend)
7. [Backend and Frontend Sync](#backend-and-frontend-sync)

---

## Auth Model

### Login Strategies

The application supports multiple authentication strategies:

1. **Email/Password** (Future)
   - Traditional email + password login
   - Password hashing with bcrypt

2. **Magic Link** (Current)
   - Passwordless authentication via email
   - Redis-based token storage
   - Email stub for development (TS-21.9)

3. **Google OAuth** (Current)
   - Primary authentication method for B2B
   - OAuth 2.0 flow with Google
   - Endpoints: `/auth/google`, `/auth/google/callback`

### Access Token

**Location**: `apps/api/src/core/auth/token.service.ts`

Short-lived JWT token (15 minutes default):

**Payload Structure**:
```typescript
type AccessTokenPayload = {
  sub: string;        // userId
  wid?: string;       // workspaceId (optional, from header)
  bid?: string;       // brandId (optional, from header, future)
  type: 'access';
};
```

**Signing**:
- Secret: `ACCESS_TOKEN_SECRET` (env var)
- Algorithm: HS256 (default JWT)
- Issuer: `brint-api`
- Expiry: `ACCESS_TOKEN_EXPIRES_IN_MINUTES` (env var, default: 15)

**Usage**:
- Sent in `Authorization: Bearer <token>` header
- Verified by `auth.context.ts` plugin on every request
- Attached to `request.auth` if valid

### Refresh Token

**Location**: `apps/api/src/core/auth/token.service.ts`

Long-lived JWT token (30 days default):

**Payload Structure**:
```typescript
type RefreshTokenPayload = {
  sub: string;        // userId
  tid: string;        // sessionId (Session.id in DB)
  type: 'refresh';
};
```

**Signing**:
- Secret: `REFRESH_TOKEN_SECRET` (env var)
- Algorithm: HS256
- Issuer: `brint-api`
- Expiry: `REFRESH_TOKEN_EXPIRES_IN_DAYS` (env var, default: 30)

**Usage**:
- Stored in HTTP-only cookie (via `cookie.ts` plugin)
- Used to obtain new access tokens via `/auth/refresh`
- `tid` maps to `Session.id` for revocation

### Session Service Pipeline

**Location**: `apps/api/src/core/auth/session.service.ts`

**Session Model** (Prisma):
```prisma
model Session {
  id           String   @id            // Matches refresh token tid
  userId       String
  user         User     @relation(...)
  expiresAt    DateTime
  userAgent    String?
  ipAddress    String?
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
}
```

**Operations**:
1. **Create Session**: On login/OAuth, create session with `tid` = refresh token ID
2. **Revoke Session**: On logout, delete session (invalidates refresh token)
3. **Revoke All Sessions**: On password change/security event
4. **Touch Session**: Update `lastActiveAt` on token refresh

**Session Lifecycle**:
```
Login → Create Session (tid) → Sign Refresh Token (tid) → Store in Cookie
Refresh → Verify Refresh Token → Touch Session → Issue New Access Token
Logout → Revoke Session (tid) → Clear Cookie
```

---

## Claims Model

### JWT Claims Structure

Claims are embedded in JWT tokens and extracted by the auth context:

**Access Token Claims**:
- `sub`: User ID (required)
- `wid`: Workspace ID (optional, from `X-Workspace-Id` header)
- `bid`: Brand ID (optional, from `X-Brand-Id` header, future)
- `type`: Token type (`'access'`)

**Refresh Token Claims**:
- `sub`: User ID (required)
- `tid`: Session ID (required, maps to `Session.id`)
- `type`: Token type (`'refresh'`)

### Claims → Resolver → Effective Permissions

**Flow**:
1. **Extract Claims**: Auth context extracts `sub`, `wid` from access token
2. **Load Workspace Member**: Query `WorkspaceMember` for `userId` + `workspaceId`
3. **Map Role**: `WorkspaceMember.role` → `Role.key` (e.g., `'owner'` → `'workspace-owner'`)
4. **Resolve Permissions**: Query `Role` → `RolePermission` → `Permission`
5. **Validate**: Filter permissions using `PERMISSIONS` registry
6. **Return**: Array of `PermissionKey[]`

**Location**: `apps/api/src/core/auth/permission.service.ts`

```typescript
const result = await permissionService.getEffectivePermissionsForUserWorkspace({
  userId: request.auth.userId,
  workspaceId: request.auth.workspaceId,
});

// result.permissions = ['workspace:settings.view', 'studio:brand.view', ...]
```

### Workspace-Level Isolation

**Multi-Tenant Structure**:
- Each user can belong to multiple workspaces
- Permissions are **workspace-scoped**
- `WorkspaceMember` table links users to workspaces with roles
- `Role` and `Permission` are **workspace-specific** (can have different permissions per workspace)

**Isolation Rules**:
1. **Workspace ID Required**: All protected endpoints require `X-Workspace-Id` header
2. **Permission Check**: `requirePermission()` checks permissions for specific `userId` + `workspaceId`
3. **Data Access**: Repositories filter by `workspaceId` (e.g., `brandRepository.listByWorkspace(workspaceId)`)

**Example**:
- User A in Workspace 1: Has `studio:brand.view`
- User A in Workspace 2: Does NOT have `studio:brand.view`
- Same user, different permissions per workspace

---

## Permission Model

### Permission Key Format

**Pattern**: `<scope>:<resource>.<action>`

**Examples**:
- `workspace:settings.view` - View workspace settings
- `workspace:members.manage` - Manage workspace members
- `studio:brand.view` - View brands in studio
- `studio:brand.create` - Create new brand
- `studio:content.create` - Create content
- `studio:content.publish` - Publish content

**Scopes**:
- `workspace:*` - Workspace-level permissions
- `studio:*` - Brand Studio permissions

### PERMISSIONS Registry

**Location**: `apps/api/src/core/auth/permissions.registry.ts`

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

**Rules**:
1. **No Magic Strings**: Always use `PERMISSIONS.*` constants
2. **Type Safety**: `PermissionKey` type ensures only valid permissions
3. **Validation**: `isPermissionKey()` validates strings from database

### Backend requirePermission

**Location**: `apps/api/src/core/auth/require-permission.ts`

Middleware function for protecting routes:

```typescript
app.get('/protected', {
  preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
}, handler);
```

**Behavior**:
1. Checks `request.auth` exists → 401 if not
2. Checks `request.auth.workspaceId` exists → 401 if not
3. Calls `permissionService.hasPermission()` → 403 if missing
4. Continues to handler if permission granted

**Error Responses**:
- **401 Unauthorized**: Missing auth or workspace context
- **403 Forbidden**: User lacks required permission

### Frontend useHasPermission + PermissionGate

**Location**: `apps/web/features/permissions/`

**Hooks**:
```typescript
import { useHasPermission, useAnyPermission } from "@/permissions";

// Single permission check
const canView = useHasPermission("studio:brand.view");

// Multiple permissions (OR logic)
const canEdit = useAnyPermission(["studio:brand.edit", "studio:brand.create"]);
```

**PermissionGate Component**:
```tsx
import { PermissionGate } from "@/permissions";

<PermissionGate 
  permission="studio:brand.view" 
  fallback={<p>No access</p>}
>
  <BrandList />
</PermissionGate>

// OR logic with array
<PermissionGate 
  permission={["studio:brand.edit", "studio:brand.create"]}
  fallback={null}
>
  <EditButton />
</PermissionGate>
```

**Current State**: Uses mock permissions (TS-33)
**Future**: Will sync with backend API (TS-40+)

---

## i18n Rules

### Locale Strategy

**Default Locale (EN)**: Prefixless
- `/dashboard` → English
- `/login` → English

**Other Locales (TR)**: Prefixed
- `/tr/dashboard` → Turkish
- `/tr/login` → Turkish

**Middleware**: `apps/web/middleware.ts` uses `next-intl` with `localePrefix: "as-needed"`

### Locale Layout Responsibilities

**Location**: `apps/web/app/[locale]/layout.tsx`

1. **Validates Locale**: Ensures `locale` param is in `locales` array
2. **Loads Messages**: Fetches translation files for locale
3. **Provides i18n**: Wraps children with `NextIntlClientProvider`
4. **Provider Hierarchy**: Sets up Auth → Workspace → Permission providers

### t() Usage Rules

**No Hardcoded Text**: All user-facing text must use translations

**✅ CORRECT**:
```tsx
import { useTranslations } from "next-intl";

const t = useTranslations("common");
return <h1>{t("loginTitle")}</h1>;
```

**❌ FORBIDDEN**:
```tsx
return <h1>Login</h1>; // Hardcoded text
```

**Translation Files**:
- `apps/web/locales/en/common.json`
- `apps/web/locales/tr/common.json`

**Rich Text**:
```tsx
t.rich("termsAndPrivacy", {
  terms: (chunks) => <a href="#">{chunks}</a>,
  privacy: (chunks) => <a href="#">{chunks}</a>,
})
```

### Locale-Aware Routing

**Navigation**:
```tsx
import { useLocale } from "next-intl";
import Link from "next/link";

const locale = useLocale();
const signupPath = locale === "en" ? "/signup" : `/${locale}/signup`;

<Link href={signupPath}>Sign Up</Link>
```

**API Routes**: Backend does NOT handle locale (frontend-only concern)

---

## Protected Flow (Backend)

### Backend Protected Route

**Step-by-Step Flow**:

1. **Request Arrives**: Fastify receives HTTP request

2. **Auth Context Plugin** (`auth.context.ts`):
   - Extracts `Authorization: Bearer <token>` header
   - Verifies access token
   - Extracts `X-Workspace-Id` header
   - Attaches `AuthContext` to `request.auth`
   - If token invalid/missing, `request.auth = null` (route remains public)

3. **requirePermission Middleware**:
   - Checks `request.auth` exists → 401 if not
   - Checks `request.auth.workspaceId` exists → 401 if not
   - Calls `permissionService.hasPermission()`:
     - Queries `WorkspaceMember` for `userId` + `workspaceId`
     - Maps role to permissions
     - Checks if required permission exists
   - Returns 403 if permission missing
   - Continues to handler if permission granted

4. **Route Handler**:
   - `request.auth` is guaranteed to exist (non-null)
   - `request.auth.workspaceId` is guaranteed to exist
   - Handler can safely use `request.auth.userId` and `request.auth.workspaceId`

**Example**:
```typescript
app.get('/studio/brands', {
  preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
}, async (request, reply) => {
  // request.auth is guaranteed to exist here
  const { userId, workspaceId } = request.auth!;
  
  const brands = await brandStudioService.getAccessibleBrands({
    userId,
    workspaceId,
  });
  
  return reply.send({ success: true, data: brands });
});
```

---

## Protected Flow (Frontend)

### Frontend Protected Route

**Step-by-Step Flow**:

1. **Layout Hierarchy**:
   - Root Layout → Locale Layout → Workspace Layout → Page

2. **Provider Initialization**:
   - `AuthProvider`: Loads user from localStorage
   - `WorkspaceProvider`: Extracts workspace from route params
   - `PermissionProvider`: Loads permissions (currently mock, future: API)

3. **Permission Check**:
   - Use `useHasPermission()` hook or `<PermissionGate>` component
   - Check if user has required permission for current workspace

4. **Conditional Rendering**:
   - If permission granted → Render protected content
   - If permission missing → Render fallback or redirect

**Example**:
```tsx
"use client";

import { useHasPermission } from "@/permissions";
import { PermissionGate } from "@/permissions";

export default function BrandStudioPage() {
  const canView = useHasPermission("studio:brand.view");
  
  if (!canView) {
    return <p>You don't have permission to view brands</p>;
  }
  
  return (
    <div>
      <h1>Brand Studio</h1>
      <PermissionGate 
        permission="studio:brand.create"
        fallback={<p>Cannot create brands</p>}
      >
        <CreateBrandButton />
      </PermissionGate>
    </div>
  );
}
```

### Locale-Aware Redirects

**Redirect on Auth Failure**:
```tsx
import { useLocale } from "next-intl";
import { redirect } from "next/navigation";

const locale = useLocale();
if (!isAuthenticated) {
  redirect(locale === "en" ? "/login" : `/${locale}/login`);
}
```

---

## Backend and Frontend Sync

### Login Flow

1. **User Logs In** (Google OAuth or Magic Link):
   - Backend validates credentials
   - Backend creates session
   - Backend signs access + refresh tokens
   - Backend returns:
     ```json
     {
       "success": true,
       "data": {
         "user": { "id": "...", "email": "...", "name": "..." },
         "accessToken": "...",
         "refreshToken": "..." // Set in HTTP-only cookie
       }
     }
     ```

2. **Frontend Receives Response**:
   - Stores user in `AuthProvider` (localStorage)
   - Stores access token (memory or secure storage)
   - Sets up HTTP client with `Authorization: Bearer <token>` header

3. **Permission Sync** (Future - TS-40+):
   - Frontend calls `/auth/me` or similar endpoint
   - Backend returns user + permissions for current workspace
   - Frontend updates `PermissionProvider` with permissions

### WorkspaceId Header

**Frontend HTTP Client**:
```typescript
import { useWorkspace } from "@/features/workspace/context/workspace-context";

const { workspace } = useWorkspace();

await httpClient.get("/studio/brands", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "X-Workspace-Id": workspace?.id,
  },
});
```

**Backend Auth Context**:
- Reads `X-Workspace-Id` header
- Attaches to `request.auth.workspaceId`
- Used by `requirePermission()` for permission checks

### Permission Sync Flow

**Current State** (TS-33):
- Frontend uses mock permissions
- No backend sync

**Future State** (TS-40+):
1. **On Workspace Change**:
   - Frontend calls `/auth/permissions?workspaceId=...`
   - Backend returns effective permissions for user + workspace
   - Frontend updates `PermissionProvider`

2. **On Permission Update** (Admin changes role):
   - Backend emits event or frontend polls
   - Frontend refreshes permissions

3. **On Token Refresh**:
   - Frontend calls `/auth/refresh`
   - Backend may return updated permissions (if changed)
   - Frontend updates `PermissionProvider`

### Token Refresh Flow

1. **Access Token Expires**:
   - Frontend HTTP client receives 401
   - Frontend calls `/auth/refresh` with refresh token (from cookie)

2. **Backend Refresh Endpoint**:
   - Verifies refresh token
   - Checks session exists and not expired
   - Touches session (`lastActiveAt`)
   - Issues new access token
   - Returns new access token

3. **Frontend Updates**:
   - Stores new access token
   - Retries original request with new token

### Logout Flow

1. **Frontend Logout**:
   - Calls `/auth/logout`
   - Clears `AuthProvider` state
   - Clears localStorage
   - Redirects to login

2. **Backend Logout**:
   - Revokes session (`sessionService.revokeSession(tid)`)
   - Clears refresh token cookie
   - Returns success

---

## Summary

### Auth Model
- **Strategies**: Google OAuth (primary), Magic Link (fallback)
- **Tokens**: Access (15min) + Refresh (30 days)
- **Sessions**: Database-backed with `tid` mapping

### Claims Model
- **Access Token**: `sub` (userId), `wid` (workspaceId), `bid` (brandId, future)
- **Refresh Token**: `sub` (userId), `tid` (sessionId)
- **Permission Resolution**: Claims → WorkspaceMember → Role → Permissions

### Permission Model
- **Format**: `<scope>:<resource>.<action>`
- **Registry**: Central `PERMISSIONS` constant (no magic strings)
- **Backend**: `requirePermission()` middleware
- **Frontend**: `useHasPermission()` + `<PermissionGate>`

### i18n Rules
- **EN**: Prefixless (`/dashboard`)
- **TR**: Prefixed (`/tr/dashboard`)
- **No Hardcoded Text**: All via `t()` function
- **Translation Files**: `locales/*/common.json`

### Protected Flows
- **Backend**: Auth Context → requirePermission → Handler
- **Frontend**: Providers → Permission Check → Conditional Render

### Sync
- **Login**: Backend returns tokens → Frontend stores user
- **WorkspaceId**: Frontend sends header → Backend attaches to auth context
- **Permissions**: Future sync via API (TS-40+)

All authentication, authorization, and i18n code must follow these patterns. When in doubt, refer to existing implementations in `apps/api/src/core/auth/` and `apps/web/features/permissions/`.
