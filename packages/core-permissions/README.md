# @brint/core-permissions

Shared permission registry package for Brint monorepo.

## Purpose

This package provides a single source of truth for all permission keys used across the application. It ensures type-safe usage and prevents magic strings throughout the codebase.

## Usage

### Backend

```ts
import { PERMISSIONS, PermissionKey, getAllPermissionKeys } from '@brint/core-permissions';

// Use in route handlers
app.get('/protected', {
  preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_MANAGE)],
}, handler);

// Type-safe permission checks
function checkPermission(key: PermissionKey) {
  // key is guaranteed to be a valid permission string
}
```

### Frontend

```tsx
import { PERMISSIONS, PermissionKey } from '@brint/core-permissions';

// Use in components
<PermissionGate permission={PERMISSIONS.STUDIO_BRAND_CREATE}>
  <CreateButton />
</PermissionGate>

// Type-safe permission checks
const canCreate = permissions.includes(PERMISSIONS.STUDIO_BRAND_CREATE);
```

## Permission Format

Permission keys follow the pattern: `<scope>:<resource>.<action>`

Examples:
- `workspace:settings.manage` - Manage workspace settings
- `workspace:members.manage` - Manage workspace members
- `studio:brand.view` - View brands in studio
- `studio:brand.create` - Create new brands
- `studio:content.create` - Create content
- `studio:content.publish` - Publish content

## Backward Compatibility

The old import paths still work for backward compatibility:
- Backend: `apps/api/src/core/auth/permissions.registry.ts` (re-exports from this package)
- Frontend: `apps/web/features/permissions/permission-keys.ts` (re-exports from this package)

However, new code should import directly from `@brint/core-permissions`.

## Adding New Permissions

1. Add the permission to `PERMISSIONS` object in `src/permissions.registry.ts`
2. Follow the naming convention: `<scope>:<resource>.<action>`
3. Update backend and frontend code to use the new permission
4. Ensure backend roles have the new permission assigned

