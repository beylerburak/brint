# Development Workflow (AI Working Rules)

> This document defines the official development workflow and AI (Cursor/ChatGPT) working discipline for this project. It serves as the authoritative reference for how AI assistants should work within this codebase.

## Table of Contents

1. [Tiny Step Methodology](#tiny-step-methodology)
2. [AI Flow (Cursor Behavior Rules)](#ai-flow-cursor-behavior-rules)
3. [Code Writing Rules](#code-writing-rules)
4. [Test Discipline](#test-discipline)
5. [Commit / PR / Branch Rules](#commit--pr--branch-rules)
6. [Debug Rules](#debug-rules)
7. [Refactor Rules](#refactor-rules)
8. [Before Coding Checklist](#before-coding-checklist)
9. [After Coding Checklist](#after-coding-checklist)

---

## Tiny Step Methodology

### Core Principles

**Tiny Steps** is the fundamental methodology for all development work in this project. Every change must be broken down into small, incremental, and deterministic steps.

#### 1. One Step at a Time

- **Single Focus**: Each Tiny Step (TS-XX) addresses exactly one feature, fix, or improvement
- **No Parallel Work**: Do not start another TS until the current one is fully complete
- **Deterministic**: Each step must have clear input → action → output flow

#### 2. Step Independence

- **No Breaking Changes**: A new Tiny Step must NOT break previous steps
- **Backward Compatible**: Existing functionality must continue to work
- **Incremental**: Each step builds upon previous work without requiring refactoring

#### 3. Large Changes Are Forbidden

- **Split Required**: Any large change must be split into multiple Tiny Steps
- **No Big Bang**: Never attempt to refactor entire modules in one step
- **Incremental Refactoring**: If refactoring is needed, it must be done within a single TS scope

#### 4. Step Lifecycle

```
Input (Requirements) → Action (Implementation) → Test (Verification) → Complete
```

Each step must:
1. Have clear requirements (from `docs/tiny-steps.md`)
2. Implement only what's required
3. Pass all test criteria
4. Not introduce regressions

#### 5. Test Criteria

Every Tiny Step in `docs/tiny-steps.md` includes a **Test** section. The step is NOT complete until:
- All test criteria are met
- TypeScript compilation succeeds
- No linter errors
- Manual testing (if applicable) passes

---

## AI Flow (Cursor Behavior Rules)

### Before Starting Work

When AI receives a task, it MUST follow this sequence:

#### 1. Read Documentation (Mandatory)

**Required Files** (in order):
1. `docs/dev-workflow.md` ← **This file** (you are reading it)
2. `docs/backend-architecture.md` (for backend work)
3. `docs/frontend-architecture.md` (for frontend work)
4. `docs/auth-claims-i18n.md` (for auth/claims/i18n work)
5. `docs/tiny-steps.md` (to find the current step)

**Why**: These documents define the project's architecture, patterns, and rules. Without reading them, AI cannot work correctly.

#### 2. Identify the Task

- **Task Format**: Tasks come as `TS-XX` (e.g., `TS-41`, `TS-23`)
- **Find in tiny-steps.md**: Locate the specific TS in `docs/tiny-steps.md`
- **Read Requirements**: Understand the goal, content, and test criteria
- **Scope Check**: Verify what files/modules are affected

#### 3. Examine Codebase

- **File Tree**: Understand the current project structure
- **Related Files**: Read existing code in the affected modules
- **Patterns**: Identify existing patterns to follow
- **Dependencies**: Check what other modules/services are involved

### During Implementation

#### 1. Incremental Changes Only

- **Stay in Scope**: Only implement what the TS requires
- **No Extra Features**: Do not add features not mentioned in the TS
- **No Premature Optimization**: Do not optimize code unless required
- **Follow Patterns**: Use existing patterns from the codebase

#### 2. Code Quality

- **TypeScript**: All code must be type-safe
- **No Magic Strings**: Use config files and constants
- **No Hardcoded Values**: All configuration via `src/config/*.ts`
- **Absolute Imports**: Use absolute imports (e.g., `@/permissions`)

#### 3. Architecture Compliance

**Backend**:
- Follow `service → repository → prisma` chain
- Use `requirePermission()` for protected routes
- Use `auth.context` for authentication
- Follow error handler pattern
- Follow success response pattern

**Frontend**:
- Maintain provider hierarchy (Auth → Workspace → Permission)
- Use `useHasPermission()` + `PermissionGate` for permissions
- Use HTTP client (no direct `fetch`)
- Forms: React Hook Form + Zod
- UI state: context/providers
- i18n: `t()` function only (no hardcoded text)
- Locale routing: prefixless EN, prefixed TR

### After Implementation

#### 1. Generate Summary

AI must provide a summary with:
- **Added Files**: List of new files created
- **Modified Files**: List of files changed
- **Test Results**: TypeScript check, linter, manual tests
- **TS Completion**: Verification that test criteria are met

#### 2. Stop After Task

- **No Extra Work**: Do not start another TS unless explicitly asked
- **No TODOs**: Do not leave TODO comments unless part of the TS
- **Task Complete**: Once test criteria are met, the task is done

---

## Code Writing Rules

### General Rules

#### 1. No Hardcoded Values

**❌ FORBIDDEN**:
```typescript
const apiUrl = "https://api.example.com";
const maxRetries = 3;
```

**✅ CORRECT**:
```typescript
// src/config/app.ts
export const appConfig = {
  apiBaseUrl: env.API_BASE_URL,
  maxRetries: env.MAX_RETRIES,
};

// Usage
import { appConfig } from "@/config";
const apiUrl = appConfig.apiBaseUrl;
```

#### 2. Configuration Layer

- **Backend**: `apps/api/src/config/*.ts`
- **Frontend**: `apps/web/src/shared/config/*.ts`
- **Flow**: `env → config → code`
- **No Direct Env Access**: Never use `process.env` directly in business logic

#### 3. Absolute Imports

**Backend**:
```typescript
import { authConfig } from "@/config";
import { logger } from "@/lib/logger";
```

**Frontend**:
```typescript
import { useHasPermission } from "@/permissions";
import { httpClient } from "@/shared/http";
```

#### 4. Test File Naming

- **Backend**: `*.spec.ts` (e.g., `user.service.spec.ts`)
- **Frontend**: `*.spec.tsx` or `*.test.tsx`
- **Location**: Same directory as source file

### Backend Rules

#### 1. requirePermission Usage

**Pattern**:
```typescript
import { requirePermission } from "@/core/auth/require-permission";
import { PERMISSIONS } from "@/core/auth/permissions.registry";

app.get('/studio/brands', {
  preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
}, async (request, reply) => {
  // Handler code
});
```

**Rules**:
- Always use `PERMISSIONS.*` constants (no magic strings)
- `requirePermission()` must be in `preHandler` array
- Handler can assume `request.auth` exists and is non-null

#### 2. Auth Context Usage

**Pattern**:
```typescript
// request.auth is guaranteed after requirePermission
const { userId, workspaceId } = request.auth!;
```

**Rules**:
- `request.auth` is set by `auth.context.ts` plugin
- After `requirePermission()`, `request.auth` is guaranteed non-null
- Use `workspaceId` for data isolation

#### 3. Service → Repository → Prisma Chain

**Pattern**:
```typescript
// Service (business logic)
export class BrandStudioService {
  constructor(private brandRepository: BrandRepository) {}
  
  async getAccessibleBrands({ userId, workspaceId }: { userId: string; workspaceId: string }) {
    return this.brandRepository.listByWorkspace(workspaceId);
  }
}

// Repository (data access)
export class BrandRepository {
  async listByWorkspace(workspaceId: string) {
    return prisma.brand.findMany({
      where: { workspaceId },
    });
  }
}
```

**Rules**:
- Service contains business logic
- Repository contains data access
- Prisma is only used in repository layer

#### 4. Error Handler Pattern

**Pattern**:
```typescript
try {
  // Operation
} catch (error) {
  logger.error({ error }, "Operation failed");
  throw error; // Let global error handler catch it
}
```

**Response Format**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

#### 5. Success Response Pattern

**Pattern**:
```typescript
return reply.send({
  success: true,
  data: result,
});
```

**Response Format**:
```json
{
  "success": true,
  "data": { /* result */ }
}
```

### Frontend Rules

#### 1. Provider Hierarchy

**Order** (must not be changed):
```tsx
<AuthProvider>
  <WorkspaceProvider>
    <PermissionProvider>
      {children}
    </PermissionProvider>
  </WorkspaceProvider>
</AuthProvider>
```

**Location**: `apps/web/app/[locale]/layout.tsx`

**Rules**:
- Hierarchy must not be broken
- Providers must be in this exact order
- Do not add providers outside this structure

#### 2. Permission Checks

**Hooks**:
```tsx
import { useHasPermission, useAnyPermission } from "@/permissions";

const canView = useHasPermission("studio:brand.view");
const canEdit = useAnyPermission(["studio:brand.edit", "studio:brand.create"]);
```

**Component**:
```tsx
import { PermissionGate } from "@/permissions";

<PermissionGate 
  permission="studio:brand.view"
  fallback={<p>No access</p>}
>
  <BrandList />
</PermissionGate>
```

**Rules**:
- Always use hooks or `PermissionGate` for permission checks
- Never hardcode permission logic
- Use `PERMISSIONS` constants (when synced with backend)

#### 3. HTTP Client Usage

**Pattern**:
```tsx
import { httpClient } from "@/shared/http";

const response = await httpClient.get("/studio/brands", {
  headers: {
    "X-Workspace-Id": workspace?.id,
  },
});
```

**Rules**:
- **No Direct Fetch**: Never use `fetch()` directly
- **Always Use httpClient**: All API calls via `httpClient`
- **Headers**: Include `X-Workspace-Id` for protected routes
- **Error Handling**: Let HTTP client handle errors

#### 4. Forms (React Hook Form + Zod)

**Pattern**:
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

**Rules**:
- All forms use React Hook Form
- All validation via Zod schemas
- No manual validation logic

#### 5. UI State Management

**Pattern**:
```tsx
// Use context for global state
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";

// Use local state for component-specific state
const [isOpen, setIsOpen] = useState(false);
```

**Rules**:
- Global state: Context/Providers
- Component state: `useState` / `useReducer`
- No global state libraries (Redux, Zustand) unless required

#### 6. i18n Rules

**Pattern**:
```tsx
import { useTranslations } from "next-intl";

const t = useTranslations("common");
return <h1>{t("loginTitle")}</h1>;
```

**Rules**:
- **No Hardcoded Text**: All user-facing text via `t()`
- **Translation Files**: `apps/web/locales/{locale}/common.json`
- **Locale Routing**:
  - EN: Prefixless (`/dashboard`)
  - TR: Prefixed (`/tr/dashboard`)

**❌ FORBIDDEN**:
```tsx
return <h1>Login</h1>; // Hardcoded text
```

**✅ CORRECT**:
```tsx
const t = useTranslations("common");
return <h1>{t("loginTitle")}</h1>;
```

---

## Test Discipline

### After Every Tiny Step

AI must verify the following before marking a TS as complete:

#### 1. TypeScript Check

```bash
# Backend
cd apps/api && npx tsc --noEmit

# Frontend
cd apps/web && npx tsc --noEmit
```

**Rules**:
- No TypeScript errors
- All types are correct
- No `any` types (unless explicitly required)

#### 2. Linter Check

```bash
# Backend
cd apps/api && pnpm lint

# Frontend
cd apps/web && pnpm lint
```

**Rules**:
- No linter errors
- Code follows project style
- Auto-fixable issues should be fixed

#### 3. Route/Endpoint Verification

**Backend**:
- Route is accessible
- Swagger documentation is updated
- `requirePermission()` works correctly
- Error responses are correct

**Frontend**:
- Route renders without errors
- Provider chain is intact
- Permission logic works
- i18n translations load

#### 4. Provider Chain Check (Frontend)

**Verification**:
- AuthProvider initializes correctly
- WorkspaceProvider extracts workspace from route
- PermissionProvider loads permissions
- No provider errors in console

#### 5. Permission Logic Check

**Backend**:
- `requirePermission()` returns 401/403 correctly
- Permission service resolves permissions correctly
- Workspace isolation works

**Frontend**:
- `useHasPermission()` returns correct boolean
- `PermissionGate` shows/hides content correctly
- Permission updates reflect in UI

#### 6. i18n Prefix Check

**Verification**:
- EN routes: No prefix (`/dashboard`)
- TR routes: Prefixed (`/tr/dashboard`)
- All text uses `t()` function
- No hardcoded strings

#### 7. Toast/Error Boundary Check

**Frontend**:
- Toast notifications work
- Error boundary catches errors
- Global error handler works
- No white screen on errors

#### 8. HTTP Client Check

**Frontend**:
- All API calls use `httpClient`
- No direct `fetch()` usage
- Headers are set correctly
- Error handling works

### Backend-Specific Tests

#### 1. Route Validation

- Route is registered correctly
- Middleware chain works
- Request/response types are correct

#### 2. Swagger Documentation

- Endpoint appears in Swagger UI
- Request/response schemas are documented
- Examples are provided (if applicable)

#### 3. requirePermission Test

- Unauthenticated request → 401
- Authenticated without permission → 403
- Authenticated with permission → 200

#### 4. Seed/Demo User Test

- Test with seed data
- Verify permissions work with demo users
- Verify workspace isolation

---

## Commit / PR / Branch Rules

> **Note**: These rules are for the repository, not for AI. AI should follow commit message format when making commits.

### Commit Message Format

**Pattern**:
```
TS-XX: Brief description of what was implemented
```

**Examples**:
```
TS-37: Brand Studio routing skeleton implemented
TS-41: dev-workflow.md documentation created
TS-23: Brand Studio sample endpoint with permission check
```

### PR Description Template

**Required Sections**:

1. **Added Files**:
   - List of new files created

2. **Modified Files**:
   - List of files changed

3. **Test Summary**:
   - TypeScript check: ✅
   - Linter: ✅
   - Manual tests: ✅
   - Test criteria from TS: ✅

4. **Breaking Changes**:
   - None (or list if any)

**Example**:
```markdown
## TS-41: dev-workflow.md Documentation

### Added Files
- `docs/dev-workflow.md`

### Modified Files
- None

### Test Summary
- TypeScript check: ✅
- Linter: ✅
- Documentation review: ✅
- All TS-41 test criteria met: ✅

### Breaking Changes
- None
```

### Branch Naming

- **Format**: `ts-XX-description` (e.g., `ts-41-dev-workflow`)
- **One TS per Branch**: Each branch should contain only one TS

---

## Debug Rules

### When AI Encounters Issues

#### 1. Fix Attempt Pattern

**Process**:
1. **Attempt 1**: Identify the issue, propose fix, implement
2. **Attempt 2**: If first fails, re-examine, try alternative approach
3. **Attempt 3**: If still failing, document the issue and ask for help

**Documentation**:
```markdown
Fix Attempt 1: [Description]
- Issue: [What was wrong]
- Solution: [What was tried]
- Result: [Success/Failure]

Fix Attempt 2: [Description]
- ...
```

#### 2. Scope Limitation

- **Task Scope Only**: Fix only what's related to the current TS
- **No Unnecessary Refactoring**: Do not refactor unrelated code
- **Minimal Changes**: Change only what's necessary to fix the issue

#### 3. Code Search Strategy

**Order**:
1. **Related Paths**: Search in affected modules first
2. **Config Files**: Check `src/config/*.ts` for configuration
3. **Core Modules**: Check `src/core/*` for shared utilities
4. **Documentation**: Re-read relevant architecture docs

**Tools**:
- Use `codebase_search` for semantic search
- Use `grep` for exact string matches
- Read related files before making changes

#### 4. State Provider Chain

**Critical Rule**: **NEVER** modify the provider hierarchy structure.

**If Provider Issue**:
- Check provider order (Auth → Workspace → Permission)
- Verify provider props
- Check for missing providers
- **Do NOT** restructure the hierarchy

#### 5. Old Files

**Rule**: Only touch old files if:
- They are directly related to the current TS
- They are causing errors that block the TS
- The TS explicitly requires changes to them

**Otherwise**: Leave old files untouched.

---

## Refactor Rules

### When Refactoring Is Allowed

#### 1. Small Refactors (Within TS Scope)

**Allowed**:
- Refactoring code added in the current TS
- Fixing naming issues in new code
- Improving code structure within TS scope
- Lint fixes

**Example**:
```typescript
// TS-23: Adding new endpoint
// Refactoring the handler function is OK
// Refactoring unrelated service is NOT OK
```

#### 2. Naming Fixes

**Allowed**:
- Fixing typos in new code
- Renaming variables for clarity (within TS scope)
- Aligning naming with project conventions

#### 3. Lint Fixes

**Allowed**:
- Auto-fixing linter errors
- Formatting code to match project style
- Removing unused imports

### When Refactoring Is Forbidden

#### 1. Large Refactors

**Forbidden**:
- Refactoring entire modules
- Changing architecture patterns
- Restructuring folder hierarchy
- Changing provider chain structure

**Reason**: Large refactors must be separate Tiny Steps or epics.

#### 2. Functional Changes

**Forbidden**:
- Refactoring that changes functionality
- "Improving" code that works correctly
- Optimizing code that's not a bottleneck

**Rule**: If it works and the TS doesn't require changes, don't touch it.

#### 3. Architecture-Wide Fixes

**Forbidden**:
- Changing core patterns (service → repository → prisma)
- Modifying provider hierarchy
- Changing config layer structure
- Modifying error handling patterns

**Reason**: These require epic-level planning and multiple TS.

---

## Before Coding Checklist

AI **MUST** complete this checklist before starting any task:

### ✅ Documentation Reading

- [ ] Read `docs/dev-workflow.md` (this file)
- [ ] Read `docs/backend-architecture.md` (for backend work)
- [ ] Read `docs/frontend-architecture.md` (for frontend work)
- [ ] Read `docs/auth-claims-i18n.md` (for auth/claims/i18n work)
- [ ] Read `docs/tiny-steps.md` and locate the current TS

### ✅ Task Understanding

- [ ] Identify the TS number (e.g., TS-41)
- [ ] Understand the goal of the TS
- [ ] Read the test criteria
- [ ] Identify affected files/modules

### ✅ Codebase Examination

- [ ] Understand current file structure
- [ ] Read related existing code
- [ ] Identify patterns to follow
- [ ] Check dependencies

### ✅ Scope Verification

- [ ] Confirm what needs to be implemented
- [ ] Confirm what should NOT be changed
- [ ] Verify no breaking changes will be introduced

---

## After Coding Checklist

AI **MUST** complete this checklist after implementing a task:

### ✅ Implementation Summary

- [ ] List all added files
- [ ] List all modified files
- [ ] Document any configuration changes

### ✅ Testing

- [ ] TypeScript check passes (`tsc --noEmit`)
- [ ] Linter check passes (`pnpm lint`)
- [ ] Manual testing (if applicable)
- [ ] All TS test criteria met

### ✅ Verification

- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] No TODO comments (unless part of TS)
- [ ] No breaking changes
- [ ] Provider chain intact (frontend)
- [ ] Permission logic works (if applicable)
- [ ] i18n rules followed (if applicable)

### ✅ Documentation

- [ ] Code follows project patterns
- [ ] No magic strings
- [ ] Config layer used correctly
- [ ] Absolute imports used

### ✅ Task Completion

- [ ] TS test criteria fully met
- [ ] Summary provided to user
- [ ] No extra work started
- [ ] Ready for next step (if requested)

---

## Summary

This document defines how AI (Cursor/ChatGPT) should work within this project:

1. **Tiny Steps**: All work is broken into small, incremental steps
2. **Documentation First**: Always read architecture docs before coding
3. **Pattern Compliance**: Follow existing patterns and architecture
4. **Test Discipline**: Verify all test criteria before completion
5. **Scope Control**: Only implement what's required, nothing more
6. **No Breaking Changes**: Each step must not break previous work

When in doubt, refer to:
- `docs/backend-architecture.md` for backend patterns
- `docs/frontend-architecture.md` for frontend patterns
- `docs/auth-claims-i18n.md` for auth/claims/i18n rules
- `docs/tiny-steps.md` for current step requirements

**Remember**: A Tiny Step is NOT complete until all test criteria are met and the code follows all project rules.
