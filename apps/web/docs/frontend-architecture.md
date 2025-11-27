# Frontend Architecture

> This document defines the frontend architecture decisions for the Brint web application. It serves as the authoritative reference for AI assistants and developers working on the frontend.

## Table of Contents

1. [Frontend Stack](#frontend-stack)
2. [Global Layout Structure](#global-layout-structure)
3. [State Management](#state-management)
4. [Routing Rules](#routing-rules)
5. [Form Standard](#form-standard)
6. [HTTP Client](#http-client)
7. [UI Standards](#ui-standards)
8. [Development Standards](#development-standards)

---

## Frontend Stack

### Core Technologies

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **UI Library**: ShadCN UI (New York style, accent color)
- **i18n**: next-intl
- **Forms**: React Hook Form + Zod
- **HTTP**: Custom HTTP client wrapper
- **Toast**: ShadCN Toast (Radix UI)
- **Error Boundary**: React Error Boundary
- **Theme**: Dark mode with class-based strategy

### Directory Structure

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── [locale]/          # Locale-aware routes
│   │   ├── [workspace]/   # Workspace-scoped routes
│   │   │   ├── studio/    # Brand Studio routes
│   │   │   │   └── [brand]/
│   │   │   ├── dashboard/
│   │   │   └── team/
│   │   ├── login/
│   │   ├── signup/
│   │   └── layout.tsx     # Locale layout (providers)
│   ├── layout.tsx         # Root layout (theme, toaster)
│   └── global-error.tsx   # Global error boundary
├── components/            # React components
│   ├── ui/               # ShadCN UI components
│   ├── login-form.tsx
│   └── theme-provider.tsx
├── src/
│   ├── contexts/         # React contexts
│   │   ├── auth-context.tsx
│   │   ├── workspace-context.tsx
│   │   ├── brand-context.tsx
│   │   └── index.ts
│   ├── permissions/      # Permission system
│   │   ├── permission-context.tsx
│   │   ├── hooks.ts
│   │   ├── PermissionGate.tsx
│   │   └── index.ts
│   └── shared/           # Shared utilities
│       ├── config/       # Frontend config
│       └── http/         # HTTP client
├── lib/                   # Utilities
│   ├── i18n/            # i18n configuration
│   └── utils.ts         # cn() helper
└── locales/              # Translation files
    ├── en/
    └── tr/
```

---

## Global Layout Structure

### Layout Hierarchy

The application uses nested layouts in this order:

1. **Root Layout** (`app/layout.tsx`)
   - HTML structure
   - Theme provider (dark mode)
   - Theme toggle button
   - Toaster component
   - Global CSS

2. **Locale Layout** (`app/[locale]/layout.tsx`)
   - NextIntlClientProvider (i18n)
   - **Provider Hierarchy**:
     ```
     AuthProvider
       └── WorkspaceProvider
         └── PermissionProvider
           └── {children}
     ```

3. **Workspace Layout** (`app/[locale]/[workspace]/layout.tsx`)
   - Workspace-scoped UI (breadcrumbs, sidebar)
   - Workspace context initialization from route params

4. **Studio Layout** (`app/[locale]/[workspace]/studio/layout.tsx`)
   - Brand Studio UI structure
   - Brand context initialization

5. **Brand Layout** (`app/[locale]/[workspace]/studio/[brand]/layout.tsx`)
   - Brand-scoped UI
   - Brand context from route params

### Provider Hierarchy

**Order matters!** Providers must be nested in this exact order:

```tsx
<AuthProvider>
  <WorkspaceProvider params={{ locale }}>
    <PermissionProvider>
      <BrandProvider params={{ brand, workspace, locale }}>
        {children}
      </BrandProvider>
    </PermissionProvider>
  </WorkspaceProvider>
</AuthProvider>
```

**Why this order?**
- `AuthProvider`: Provides user authentication state
- `WorkspaceProvider`: Depends on auth (needs userId for workspace selection)
- `PermissionProvider`: Depends on workspace (permissions are workspace-scoped)
- `BrandProvider`: Depends on workspace (brands belong to workspaces)

---

## State Management

### Auth Context

**Location**: `src/contexts/auth-context.tsx`

Manages user authentication state:

```typescript
type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}
```

**Persistence**: Uses `localStorage` with key `auth_user`

**Usage**:
```tsx
const { user, isAuthenticated, login, logout } = useAuth();
```

### Workspace Context

**Location**: `src/contexts/workspace-context.tsx`

Manages current workspace selection:

```typescript
type Workspace = {
  id: string;
  slug: string;
  name?: string;
};

interface WorkspaceContextValue {
  workspace: Workspace | null;
  setWorkspace: (ws: Workspace | null) => void;
}
```

**Initialization**: 
- Extracts from route params: `/[locale]/[workspace]/...`
- Falls back to pathname parsing if params not available
- Ignores reserved routes (login, signup, debug-*)

**Usage**:
```tsx
const { workspace, setWorkspace } = useWorkspace();
```

### Permission Context

**Location**: `src/permissions/permission-context.tsx`

Manages user permissions for current workspace:

```typescript
type Permission = string; // e.g., "studio:brand.view"

interface PermissionContextValue {
  permissions: Permission[];
  setPermissions: (p: Permission[]) => void;
}
```

**Current State**: Uses mock permissions (TS-33)
**Future**: Will sync with backend API (TS-40+)

**Usage**:
```tsx
const { permissions, setPermissions } = usePermissionContext();
```

### Brand Context

**Location**: `src/contexts/brand-context.tsx`

Manages current brand selection:

```typescript
type Brand = {
  id: string;
  slug: string;
  name?: string;
};

interface BrandContextValue {
  brand: Brand | null;
  setBrand: (b: Brand | null) => void;
}
```

**Initialization**: Extracts from route: `/[locale]/[workspace]/studio/[brand]/...`

**Usage**:
```tsx
const { brand, setBrand } = useBrand();
```

---

## Routing Rules

### Locale Routing

- **Default Locale (EN)**: Prefixless
  - `/dashboard` → English
  - `/login` → English

- **Other Locales (TR)**: Prefixed
  - `/tr/dashboard` → Turkish
  - `/tr/login` → Turkish

**Middleware**: `middleware.ts` uses `next-intl` with `localePrefix: "as-needed"`

### Workspace Routing

- **Format**: `/[locale]/[workspace]/...`
- **Examples**:
  - `/acme/dashboard` (EN, workspace: "acme")
  - `/tr/acme/dashboard` (TR, workspace: "acme")

### Studio Routing

- **Format**: `/[locale]/[workspace]/studio/...`
- **Brand Selection**: `/[locale]/[workspace]/studio` (list brands)
- **Brand Dashboard**: `/[locale]/[workspace]/studio/[brand]/dashboard`

### Reserved Routes

These routes are NOT workspaces:
- `login`, `signup`
- `debug-*` (debug-context, debug-error, etc.)
- `config-debug`, `http-debug`

### Route Examples

```
/                          → Home (EN)
/login                     → Login (EN)
/tr/login                  → Login (TR)
/acme/dashboard            → Workspace dashboard (EN)
/tr/acme/dashboard         → Workspace dashboard (TR)
/acme/studio               → Brand selection (EN)
/acme/studio/nike/dashboard → Brand dashboard (EN)
```

---

## Form Standard

### React Hook Form + Zod

All forms must use:
1. **Zod schema** for validation
2. **React Hook Form** for form state
3. **ShadCN Form components** for UI

### Example Form

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Handle submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Form Rules

1. **Always use Zod schema** for validation
2. **Always use RHF resolver** (`zodResolver`)
3. **Always use ShadCN Form components** (Form, FormField, etc.)
4. **Client-side validation** before API call
5. **Show validation errors** via FormMessage

---

## HTTP Client

### HTTP Client Wrapper

**Location**: `src/shared/http/http-client.ts`

Custom HTTP client that wraps `fetch`:

```typescript
import { httpClient } from "@/shared/http";

// GET request
const response = await httpClient.get<Brand[]>("/studio/brands", {
  headers: {
    "Authorization": `Bearer ${token}`,
    "X-Workspace-Id": workspaceId,
  },
});

if (response.ok) {
  const brands = response.data;
} else {
  console.error(response.message);
}
```

### Response Format

```typescript
type HttpResponse<T> = 
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string; details?: unknown };
```

### HTTP Client Rules

1. **No raw `fetch`**: Always use `httpClient`
2. **Always include headers**: Authorization, X-Workspace-Id, X-Brand-Id
3. **Handle errors**: Check `response.ok` before using `response.data`
4. **Logging**: HTTP client logs all requests/responses to console

### Config Integration

**Location**: `src/shared/config/app.ts`

HTTP client uses `appConfig.apiBaseUrl`:

```typescript
export const appConfig: AppConfig = {
  apiBaseUrl: "http://localhost:3001",
  defaultLocale: "en",
  supportedLocales: ["en", "tr"],
};
```

**No hardcoded URLs**: Always use `appConfig.apiBaseUrl`

---

## UI Standards

### Toast System

**Location**: `components/ui/toast.tsx`, `components/ui/toaster.tsx`

ShadCN Toast for user notifications:

```tsx
import { useToast } from "@/components/ui/use-toast";

const { toast } = useToast();

// Success
toast({
  title: "Success",
  description: "Brand created successfully",
});

// Error
toast({
  title: "Error",
  description: "Failed to create brand",
  variant: "destructive",
});
```

**Toaster Component**: Must be included in root layout (`app/layout.tsx`)

### Error Boundary

**Location**: `app/global-error.tsx`

Global error boundary catches React errors:

```tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

### Theme Provider

**Location**: `components/theme-provider.tsx`

Dark mode with class-based strategy:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

**Theme Toggle**: `components/theme-toggle.tsx` (included in root layout)

### Global Components Directory

**Location**: `components/`

- `components/ui/`: ShadCN UI components (Button, Input, Form, etc.)
- `components/login-form.tsx`: Feature components
- `components/theme-provider.tsx`: Theme infrastructure

**Rule**: All reusable UI components go in `components/`

---

## Development Standards

### File Naming

- **Pages**: `page.tsx` (Next.js App Router convention)
- **Layouts**: `layout.tsx`
- **Components**: `kebab-case.tsx` (e.g., `login-form.tsx`)
- **Contexts**: `*-context.tsx` (e.g., `auth-context.tsx`)
- **Hooks**: `hooks.ts` or `use-*.ts`
- **Config**: `*.ts` in `src/shared/config/`

### Absolute Imports

Use `@/` alias for `src/` and root:

```tsx
// ✅ CORRECT
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/shared/config";

// ❌ FORBIDDEN: Relative imports
import { useAuth } from "../../contexts/auth-context";
```

### i18n Rules

**Location**: `lib/i18n/i18n.ts`, `locales/*/common.json`

1. **No Hardcoded Text**: All user-facing text must use `t()`
2. **Translation Files**: `locales/en/common.json`, `locales/tr/common.json`
3. **Usage**:
   ```tsx
   import { useTranslations } from "next-intl";
   
   const t = useTranslations("common");
   return <h1>{t("loginTitle")}</h1>;
   ```
4. **Rich Text**: Use `t.rich()` for links/formatting
   ```tsx
   t.rich("termsAndPrivacy", {
     terms: (chunks) => <a href="#">{chunks}</a>,
     privacy: (chunks) => <a href="#">{chunks}</a>,
   })
   ```

### Permission Usage

**Location**: `src/permissions/`

1. **Permission Hooks**:
   ```tsx
   import { useHasPermission, useAnyPermission } from "@/permissions";
   
   const canView = useHasPermission("studio:brand.view");
   const canEdit = useAnyPermission(["studio:brand.edit", "studio:brand.create"]);
   ```

2. **PermissionGate Component**:
   ```tsx
   import { PermissionGate } from "@/permissions";
   
   <PermissionGate permission="studio:brand.view" fallback={<p>No access</p>}>
     <BrandList />
   </PermissionGate>
   ```

### Component Patterns

1. **Client Components**: Use `"use client"` directive
2. **Server Components**: Default (no directive)
3. **Context Providers**: Always client components
4. **Forms**: Always client components (RHF requires client)

### Tiny Step Discipline

- Each feature is a Tiny Step (TS-XX)
- Complete one TS before starting another
- Test criteria must be met before TS is considered complete
- See `docs/tiny-steps.md` for TS definitions

---

## Summary

The frontend follows a **modern, scalable Next.js architecture**:

- **Stack**: Next.js App Router + TypeScript + ShadCN UI + next-intl
- **Layout Hierarchy**: Root → Locale → Workspace → Studio → Brand
- **Provider Order**: Auth → Workspace → Permission → Brand
- **Routing**: Prefixless EN, prefixed TR, workspace-first structure
- **Forms**: RHF + Zod + ShadCN Form components
- **HTTP**: Custom client wrapper (no raw fetch)
- **UI**: Toast, Error Boundary, Theme Provider
- **i18n**: No hardcoded text, all via `t()`
- **Permissions**: Hooks + PermissionGate component

All code must follow these patterns. When in doubt, refer to existing components (e.g., `login-form.tsx`) as examples.

