# Frontend Architecture

> Brint web uygulamasının frontend mimarisinin kısa rehberi. Amaç: feature-based yapı, routing-only app, paylaşılan infra katmanı ve net provider zinciri.

## İçindekiler
- Stack
- Klasör yapısı
- Layout / provider zinciri
- Feature modülleri
- Shared katmanı
- Routing & delege kalıpları
- UI / DS
- Aliaslar & import örnekleri
- Geliştirme / test notları

---

## Stack
- **Framework**: Next.js 16 (App Router, RSC)
- **Dil**: TypeScript
- **UI**: ShadCN UI (New York)
- **i18n**: next-intl
- **Form**: React Hook Form + Zod
- **HTTP**: Özel http-client + token storage
- **Tema**: class-based dark/light (ThemeProvider)

## Klasör Yapısı

### Genel Yapı
```
apps/web/
├── app/                       # Sadece routing & layout delegasyonu
│   ├── layout.tsx             # Root (tema, toaster)
│   ├── [locale]/layout.tsx    # Locale + provider zinciri
│   ├── [locale]/[workspace]/layout.tsx
│   └── ... (auth/workspace sayfaları feature page'lerine delege)
├── features/                  # Domain katmanı (feature-based)
│   ├── auth/                  # Auth feature
│   │   ├── api/               # auth-api.ts
│   │   ├── components/         # login-form, signup-form, logout-button, language-switcher
│   │   └── context/            # auth-context.tsx
│   ├── workspace/              # Workspace feature
│   │   ├── api/                # subscription-api.ts, user-api.ts
│   │   ├── components/         # sidebar, space-guard, space-header
│   │   ├── context/            # workspace-context.tsx
│   │   ├── navigation/        # navigation.ts (sidebar config)
│   │   └── pages/             # dashboard-page, settings-page, studio-page, brand-dashboard-page
│   ├── brand/                 # Brand feature
│   │   └── context/           # brand-context.tsx
│   ├── permissions/           # Permissions feature
│   │   ├── components/        # PermissionGate.tsx
│   │   ├── context/           # permission-context.tsx
│   │   ├── hooks/            # hooks.ts (usePermissions, useHasPermission)
│   │   └── index.ts          # Re-export dosyası
│   └── subscription/         # Subscription feature
│       ├── config/            # plans.ts, limits.ts
│       ├── context/           # subscription-context.tsx
│       ├── hooks/            # use-has-limit.ts, use-subscription-limits.ts
│       ├── utils/            # limit-checker.ts
│       └── index.ts          # Re-export dosyası
├── shared/                    # Infra / utilities (paylaşılan altyapı)
│   ├── http/                  # http-client, onUnauthenticated
│   ├── auth/                  # token-storage
│   ├── config/                # appConfig
│   ├── i18n/                  # locales, i18n loader
│   ├── routing/               # route-resolver
│   ├── utils/                 # cn helper
│   ├── hooks/                 # useIsMobile
│   └── api/                   # media.ts (workspace-specific olmayan API'ler)
├── components/                # Design system + app shell
│   ├── ui/                    # ShadCN UI kit (DS)
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   └── protected-layout.tsx   # Auth shell
└── locales/                   # Çeviri dosyaları (en/tr)
```

### Feature-Based Structure

Her feature kendi domain'ini kapsar ve şu yapıyı takip eder:

```
features/{feature-name}/
├── api/              # Feature-specific API çağrıları (opsiyonel)
├── components/       # Feature-specific UI component'leri (opsiyonel)
├── context/          # Feature-specific React context (opsiyonel)
├── hooks/            # Feature-specific custom hooks (opsiyonel)
├── navigation/       # Feature-specific routing/navigation config (opsiyonel)
├── pages/            # Feature-specific page component'leri (opsiyonel)
├── utils/            # Feature-specific utility fonksiyonları (opsiyonel)
└── index.ts          # Re-export dosyası (opsiyonel, önerilir)
```

**Örnekler:**
- `features/auth/` - Authentication domain (login, signup, logout, session management)
- `features/workspace/` - Workspace domain (workspace management, sidebar, navigation)
- `features/brand/` - Brand domain (brand context, studio features)
- `features/permissions/` - Permissions domain (permission checks, gates)

## Layout / Provider Zinciri
Sıra değişmez:
```tsx
<AuthProvider>
  <WorkspaceProvider params={{ locale }}>
    <PermissionProvider>
      <SubscriptionProvider>
        <BrandProvider params={{ brand, workspace, locale }}>
          {children}
        </BrandProvider>
      </SubscriptionProvider>
    </PermissionProvider>
  </WorkspaceProvider>
</AuthProvider>
```
- Root layout: ThemeProvider + Toaster.
- Locale layout: NextIntlClientProvider + ProtectedLayout + SpaceGuard.
- Workspace layout: SubscriptionProvider + sidebar + header (workspace shell).
- Studio layout: BrandProvider sarıyor (brand context).

## Feature Modülleri

### Auth Feature (`features/auth/`)
- **API**: `api/auth-api.ts` - Magic link, Google OAuth, session management
- **Components**: `components/` - LoginForm, SignupForm, LogoutButton, LanguageSwitcher
- **Context**: `context/auth-context.tsx` - AuthProvider, useAuth hook
- **Kullanım**: Authentication, session yönetimi, login/logout akışları

### Workspace Feature (`features/workspace/`)
- **API**: `api/` - subscription-api.ts, user-api.ts (workspace-specific API'ler)
- **Components**: `components/` - Sidebar (space-sidebar, nav-main, nav-projects, nav-user, space-switcher), SpaceGuard, SpaceHeader
- **Context**: `context/workspace-context.tsx` - WorkspaceProvider, useWorkspace hook
- **Navigation**: `navigation/navigation.ts` - Sidebar navigation configuration
- **Pages**: `pages/` - DashboardPage, SettingsPage, StudioPage, BrandDashboardPage
- **Kullanım**: Workspace yönetimi, sidebar, workspace routing

### Brand Feature (`features/brand/`)
- **Context**: `context/brand-context.tsx` - BrandProvider, useBrand hook
- **Kullanım**: Brand context (studio/brand rotaları için)

### Permissions Feature (`features/permissions/`)
- **Components**: `components/PermissionGate.tsx` - Permission-based UI gating
- **Context**: `context/permission-context.tsx` - PermissionProvider, usePermissionContext hook
- **Hooks**: `hooks/hooks.ts` - usePermissions, useHasPermission, useAnyPermission
- **Index**: `index.ts` - Re-export dosyası (`@/permissions` alias ile erişim)
- **Kullanım**: Permission checks, UI visibility control (şu an mock, gelecekte API ile beslenecek)

### Subscription Feature (`features/subscription/`)
- **Config**: `config/plans.ts`, `config/limits.ts` - Plan limit tanımları
- **Context**: `context/subscription-context.tsx` - SubscriptionProvider, useSubscription hook
- **Hooks**: `hooks/use-has-limit.ts`, `hooks/use-subscription-limits.ts` - Limit check hooks
- **Utils**: `utils/limit-checker.ts` - Limit validation utilities
- **Index**: `index.ts` - Re-export dosyası
- **Kullanım**: Subscription plan bazlı limit yönetimi, feature gating (workspace count, brand count, social accounts, content limits)
- **Dokümantasyon**: `docs/subscription-limits-guide.md` - Detaylı kullanım rehberi

## Shared Katmanı

Shared katmanı, tüm feature'lar tarafından kullanılan altyapı ve utility'leri içerir:

- **HTTP**: `shared/http/http-client.ts` - HTTP client (401 → refresh, onUnauthenticated event)
- **Token storage**: `shared/auth/token-storage.ts` - Access token localStorage yönetimi
- **Config**: `shared/config/app.ts` - Uygulama konfigürasyonu (API base URL, vb.)
- **Routing**: `shared/routing/route-resolver.ts` - Login/onboarding yönlendirme logic'i
- **i18n**: `shared/i18n/` - i18n.ts, locales.ts, types.ts (locale yönetimi)
- **Utils**: `shared/utils/index.ts` - cn helper (className merge utility)
- **Hooks**: `shared/hooks/use-mobile.ts` - Mobile detection hook
- **API**: `shared/api/media.ts` - Media upload API (workspace-specific olmayan, genel API)

**Not**: Workspace-specific API'ler (`subscription`, `user`) artık `features/workspace/api/` altında.

## Routing & Delege Kalıpları
- App dosyaları routing-only, feature page bileşenlerine delege:
  - `/[locale]/[workspace]/dashboard` → `WorkspaceDashboardPage`
  - `/[locale]/[workspace]/settings` → `WorkspaceSettingsPage`
  - `/[locale]/[workspace]/studio` → `WorkspaceStudioPage`
  - `/[locale]/[workspace]/studio/[brand]/dashboard` → `BrandDashboardPage`
- Auth sayfaları: `LoginForm` / `SignupForm` `features/auth/components` altından kullanılır.
- Locale prefix: `localePrefix: "as-needed"` (en prefixsiz, diğerleri prefiksli).
- Reserved routes (workspace sayılmaz): `login`, `signup`, `debug-*`, `config-debug`, `http-debug`, `auth/*`, `invites`.

## UI / DS
- `components/ui/*`: ShadCN kit.
- `components/theme-provider.tsx`, `components/theme-toggle.tsx`: tema kontrolü.
- `components/protected-layout.tsx`: auth shell; SpaceGuard yönlendirme yapar.

## Aliaslar & Import Pattern'leri

### Path Aliases (tsconfig.json)
```json
{
  "@/*": ["./*"],
  "@/features/*": ["./features/*"],
  "@/shared/*": ["./shared/*"],
  "@/components/*": ["./components/*"],
  "@/locales/*": ["./locales/*"],
  "@/permissions": ["./features/permissions/index"],
  "@/permissions/*": ["./features/permissions/*"]
}
```

### Import Pattern'leri

#### Feature Imports
```typescript
// Auth feature
import { useAuth, AuthProvider } from "@/features/auth/context/auth-context";
import { requestMagicLink, getGoogleOAuthUrl } from "@/features/auth/api/auth-api";
import { LoginForm, SignupForm } from "@/features/auth/components/login-form";

// Workspace feature
import { useWorkspace, WorkspaceProvider } from "@/features/workspace/context/workspace-context";
import { getWorkspaceSubscription } from "@/features/workspace/api/subscription-api";
import { SpaceSidebar } from "@/features/workspace/components/sidebar/space-sidebar";
import { sidebarNavigation } from "@/features/workspace/navigation/navigation";
import { DashboardPage } from "@/features/workspace/pages/dashboard-page";

// Brand feature
import { useBrand, BrandProvider } from "@/features/brand/context/brand-context";

// Permissions feature
import { useHasPermission, PermissionGate } from "@/permissions";
// veya
import { useHasPermission } from "@/features/permissions";

// Subscription feature
import { useSubscription, useCanCreate, useRemaining, useSubscriptionLimits } from "@/features/subscription";
```

#### Shared Infrastructure Imports
```typescript
// HTTP client
import { httpClient } from "@/shared/http";

// Config
import { appConfig } from "@/shared/config";

// Token storage
import { setAccessToken, getAccessToken } from "@/shared/auth/token-storage";

// Routing
import { routeResolver } from "@/shared/routing/route-resolver";

// i18n
import { locales, defaultLocale } from "@/shared/i18n/locales";

// Utils & Hooks
import { cn } from "@/shared/utils";
import { useMobile } from "@/shared/hooks/use-mobile";
```

#### UI Primitives
```typescript
// ShadCN UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// App shell components
import { ProtectedLayout } from "@/components/protected-layout";
import { ThemeProvider } from "@/components/theme-provider";
```

### Import Best Practices

1. **Feature imports**: Her zaman feature path'ini kullan (`@/features/{feature}/...`)
2. **Shared imports**: Shared infrastructure için `@/shared/...` kullan
3. **UI imports**: ShadCN ve app shell için `@/components/...` kullan
4. **Permissions**: `@/permissions` alias'ı kullanılabilir (re-export dosyası sayesinde)
5. **Index files**: Feature'lar `index.ts` ile re-export yapabilir (opsiyonel ama önerilir)

## Yeni Feature Ekleme Rehberi

Yeni bir feature eklerken şu adımları izleyin:

### 1. Klasör Yapısı Oluştur
```
features/{feature-name}/
├── api/              # API çağrıları (eğer gerekirse)
├── components/       # UI component'leri (eğer gerekirse)
├── context/          # React context (eğer gerekirse)
├── hooks/            # Custom hooks (eğer gerekirse)
├── navigation/       # Routing/navigation config (eğer gerekirse)
├── pages/            # Page component'leri (eğer gerekirse)
├── utils/            # Utility fonksiyonları (eğer gerekirse)
└── index.ts          # Re-export dosyası (opsiyonel ama önerilir)
```

### 2. Dosyaları Oluştur
- Feature-specific logic'i ilgili klasöre ekleyin
- Shared infrastructure'ı kullanın (`@/shared/http`, `@/shared/config`, vb.)
- Diğer feature'ları import ederken feature path'lerini kullanın

### 3. Index Dosyası (Opsiyonel)
```typescript
// features/{feature-name}/index.ts
export * from "./context/{feature}-context";
export * from "./api/{feature}-api";
export * from "./components/{feature}-component";
```

### 4. Import Pattern'leri
- Feature içi: Relative import'lar kullanılabilir
- Feature dışı: `@/features/{feature}/...` path alias'ı kullanın
- Shared: `@/shared/...` kullanın

### 5. Provider Ekleme (Eğer Context Varsa)
Layout dosyasına provider'ı ekleyin:
```typescript
// app/[locale]/layout.tsx veya ilgili layout
import { FeatureProvider } from "@/features/{feature}/context/{feature}-context";

// Provider chain'e ekleyin
<FeatureProvider>
  {children}
</FeatureProvider>
```

### Örnek: Media Feature
```
features/media/
├── api/
│   └── media-api.ts        # presignUpload, finalizeUpload (shared/api/media.ts'den taşınabilir)
├── components/
│   └── media-uploader.tsx  # Media upload component
└── index.ts
```

## Geliştirme / Test Notları

### Development
- `pnpm lint` ile TS/ESLint kontrolü
- Dev server: `pnpm dev:web`
- TypeScript build: `npx tsc --noEmit`

### Test Checklist
- [ ] `pnpm lint` temiz
- [ ] `pnpm dev:web` hatasız başlıyor
- [ ] TypeScript build başarılı
- [ ] Feature import'ları doğru path'leri kullanıyor
- [ ] Provider chain çalışıyor (eğer context varsa)
- [ ] Shared infrastructure doğru kullanılıyor

### Notlar
- Permissions mock; ileride backend entegrasyonu planlanıyor
- Media API (`shared/api/media.ts`) henüz feature'a taşınmadı, ileride `features/media/` altına taşınabilir
- Middleware deprecation uyarısı için proxy konvansiyonuna geçiş önerilir
