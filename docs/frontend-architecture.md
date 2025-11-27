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

## Klasör Yapısı (özet)
```
apps/web/
├── app/                       # Sadece routing & layout delegasyonu
│   ├── layout.tsx             # Root (tema, toaster)
│   ├── [locale]/layout.tsx    # Locale + provider zinciri
│   ├── [locale]/[workspace]/layout.tsx
│   └── ... (auth/workspace sayfaları feature page'lerine delege)
├── features/                  # Domain katmanı
│   ├── auth/                  # api, components, pages
│   ├── workspace/             # context, navigation, components, pages
│   ├── brand/                 # context
│   └── permissions/           # context, hooks, gate
├── shared/                    # Infra / utilities
│   ├── http/                  # http-client, onUnauthenticated
│   ├── auth/                  # token-storage
│   ├── config/                # appConfig
│   ├── i18n/                  # locales, i18n loader
│   ├── routing/               # route-resolver
│   ├── utils/                 # cn helper
│   ├── hooks/                 # useIsMobile
│   └── api/                   # user, media, subscription
├── components/                # Design system + app shell
│   ├── ui/                    # ShadCN UI kit (DS)
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   └── protected-layout.tsx   # Auth shell
└── locales/                   # Çeviri dosyaları (en/tr)
```

## Layout / Provider Zinciri
Sıra değişmez:
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
- Root layout: ThemeProvider + Toaster.
- Locale layout: NextIntlClientProvider + ProtectedLayout + WorkspaceGuard.
- Workspace layout: sidebar + header (workspace shell).
- Studio layout: BrandProvider sarıyor (brand context).

## Feature Modülleri
- **Auth** (`features/auth`): Auth API (`auth-api.ts`), bileşenler (login/signup/logout/language-switcher).
- **Workspace** (`features/workspace`): context, navigation, sidebar bileşenleri, workspace page komponentleri (dashboard, settings, studio, brand dashboard).
- **Brand** (`features/brand`): brand context (studio/brand rotaları için).
- **Permissions** (`features/permissions`): permission context + hooks + `PermissionGate` (şu an mock, gelecekte API ile beslenecek).

## Shared Katmanı
- **HTTP**: `shared/http/http-client.ts` (401 → refresh, onUnauthenticated event).
- **Token storage**: `shared/auth/token-storage.ts`.
- **Config**: `shared/config/app.ts`.
- **Routing**: `shared/routing/route-resolver.ts` (login/onboarding yönlendirme).
- **i18n**: `shared/i18n/i18n.ts`, `shared/i18n/locales.ts`.
- **Utils**: `shared/utils/index.ts` (cn).
- **API**: `shared/api/{media,user,subscription}.ts`.
- **Hooks**: `shared/hooks/use-mobile.ts`.

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
- `components/protected-layout.tsx`: auth shell; WorkspaceGuard yönlendirme yapar.

## Aliaslar & Import Örnekleri
- Aliaslar (tsconfig): `@/features/*`, `@/shared/*`, `@/components/*`, `@/locales/*`, `@/app/*`, `@/permissions`.
- Örnekler:
  - `import { requestMagicLink } from "@/features/auth/api/auth-api";`
  - `import { WorkspaceDashboardPage } from "@/features/workspace/pages/dashboard-page";`
  - `import { routeResolver } from "@/shared/routing/route-resolver";`
  - `import { httpClient } from "@/shared/http";`

## Geliştirme / Test Notları
- `pnpm lint` ile TS/ESLint kontrolü.
- Dev server: `pnpm dev:web` (middleware deprecation uyarısı için proxy konvansiyonuna geçiş önerilir).
- Permissions mock; ileride backend entegrasyonu planlanıyor.
