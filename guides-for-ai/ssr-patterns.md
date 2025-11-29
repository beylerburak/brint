# SSR Patterns & Guidelines

Bu dokümantasyon, BRINT frontend projesinde Server-Side Rendering (SSR) kullanırken takip edilmesi gereken pattern'leri ve kuralları açıklar.

## 📋 İçindekiler

1. [Genel Prensipler](#genel-prensipler)
2. [Server-Side Data Fetching](#server-side-data-fetching)
3. [Route Pattern'leri](#route-patternleri)
4. [Component Yapısı](#component-yapısı)
5. [Yeni Sayfa/Feature Eklerken](#yeni-sayfafeature-eklerken)
6. [Yaygın Hatalar ve Çözümleri](#yaygın-hatalar-ve-çözümleri)

---

##- Genel Prensipler

### ✅ Yapılması Gerekenler

1. **Data fetch server-side'da yapılmalı**
   - `app/[locale]/[workspace]/.../page.tsx` dosyaları async server component olmalı
   - Data fetch işlemleri `shared/api/server/*` altındaki helper'lar kullanılarak yapılmalı

2. **UI ve interactivity client-side'da kalmalı**
   - Feature component'leri (`features/*/pages/*`) client component olabilir
   - `useState`, `useEffect`, `useQuery` gibi hook'lar client component'lerde kullanılabilir

3. **Initial data prop olarak geçilmeli**
   - Server component'ten client component'e `initialData` prop'u ile data geçilmeli
   - Client component başlangıç state'ini `initialData` ile set edebilir

### ❌ Yapılmaması Gerekenler

1. **Client component'lerde server-side API çağrısı yapılmamalı**
   - `shared/api/server/*` altındaki fonksiyonlar sadece server component'lerde kullanılmalı
   - Client component'lerde `httpClient` veya `shared/api/*` (client-side API) kullanılmalı

2. **Server component'lerde client-side hook'lar kullanılmamalı**
   - `useState`, `useEffect`, `useRouter` gibi hook'lar server component'lerde kullanılamaz
   - Bu hook'lar sadece `"use client"` direktifi olan component'lerde kullanılabilir

3. **Cookie'ler doğrudan erişilmemeli**
   - Server-side'da cookie'lere erişim `next/headers` → `cookies()` üzerinden yapılmalı
   - `serverFetch` helper'ı otomatik olarak cookie'lerden token alır

---

## Server-Side Data Fetching

### Helper'lar

#### 1. `serverFetch<T>(input: string, init?: RequestInit): Promise<T>`

**Konum:** `shared/api/server/server-fetch.ts`

**Kullanım:**
```typescript
import { serverFetch } from "@/shared/api/server/server-fetch";

// Basit GET request
const data = await serverFetch<ResponseType>("/endpoint");

// POST request
const result = await serverFetch<ResponseType>("/endpoint", {
  method: "POST",
  body: JSON.stringify({ key: "value" }),
});
```

**Özellikler:**
- Otomatik olarak `access_token` cookie'sinden token alır
- `Authorization: Bearer <token>` header'ını ekler
- `Content-Type: application/json` header'ını ekler
- `cache: "no-store"` ile her zaman fresh data
- Error handling yapar

#### 2. `getCurrentSession(): Promise<ServerSession | null>`

**Konum:** `shared/api/server/session.ts`

**Kullanım:**
```typescript
import { getCurrentSession } from "@/shared/api/server/session";

const session = await getCurrentSession();
if (!session) {
  // User not authenticated
  redirect("/login");
}
```

**Döndürdüğü veri:**
- `user`: Current user bilgileri
- `ownerWorkspaces`: User'ın owner olduğu workspace'ler
- `memberWorkspaces`: User'ın member olduğu workspace'ler
- `invites`: Pending invite'lar

#### 3. Feature-specific server API fonksiyonları

**Konum:** `shared/api/server/<feature>.ts`

**Örnek:** `getWorkspaceDashboardData()`

```typescript
import { getWorkspaceDashboardData } from "@/shared/api/server/space";

const data = await getWorkspaceDashboardData({
  workspaceSlug: "my-workspace",
});
```

**Kural:** Her feature için server-side API fonksiyonları `shared/api/server/` altında ayrı dosyalarda tutulmalı.

---

## Route Pattern'leri

### Dashboard Route Örneği

```typescript
// app/[locale]/[workspace]/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getWorkspaceDashboardData } from "@/shared/api/server/space";
import { DashboardPage } from "@/features/space/pages/dashboard-page";

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
  }>;
}

export default async function DashboardRoute({ params }: PageProps) {
  const { workspace: workspaceSlug } = await params;

  // Server-side data fetch
  const data = await getWorkspaceDashboardData({
    workspaceSlug,
  });

  // Error handling: redirect if not found
  if (!data) {
    redirect("/not-found");
  }

  // Pass data to client component
  return <DashboardPage initialData={data} />;
}
```

### Workspace Root Route (Redirect Pattern)

```typescript
// app/[locale]/[workspace]/page.tsx
import { redirect } from "next/navigation";
import { getWorkspaceDashboardData } from "@/shared/api/server/space";

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
  }>;
}

export default async function WorkspacePage({ params }: PageProps) {
  const { locale, workspace: workspaceSlug } = await params;

  // Check if workspace exists
  const data = await getWorkspaceDashboardData({
    workspaceSlug,
  });

  if (!data) {
    redirect("/not-found");
  }

  // SSR redirect to dashboard
  redirect(`/${locale}/${workspaceSlug}/dashboard`);
}
```

### Önemli Notlar

1. **`params` Promise olarak gelir** (Next.js 15+)
   - Her zaman `await params` yapılmalı
   - TypeScript tipi: `Promise<{ locale: string; workspace: string }>`

2. **Redirect kullanımı**
   - `next/navigation` → `redirect()` kullanılmalı
   - Client-side redirect (`useRouter`) server component'lerde kullanılamaz

3. **Error handling**
   - Workspace/user bulunamazsa → `redirect("/not-found")`
   - Auth gerekliyse → `redirect("/login")` veya benzeri

---

## Component Yapısı

### Server Component (Route Entry)

```typescript
// app/[locale]/[workspace]/feature/page.tsx
import { redirect } from "next/navigation";
import { getFeatureData } from "@/shared/api/server/feature";
import { FeaturePage } from "@/features/feature/pages/feature-page";

interface PageProps {
  params: Promise<{ locale: string; workspace: string }>;
}

export default async function FeatureRoute({ params }: PageProps) {
  const { workspace } = await params;
  
  const data = await getFeatureData({ workspace });
  
  if (!data) {
    redirect("/not-found");
  }
  
  return <FeaturePage initialData={data} />;
}
```

### Client Component (UI & Interactivity)

```typescript
// features/feature/pages/feature-page.tsx
"use client";

import { useState, useEffect } from "react";
import type { FeatureData } from "@/shared/api/server/feature";

interface FeaturePageProps {
  initialData: FeatureData;
}

export function FeaturePage({ initialData }: FeaturePageProps) {
  // Use initialData for initial state
  const [data, setData] = useState(initialData);
  
  // Client-side interactivity
  useEffect(() => {
    // Client-side logic here
  }, []);
  
  return (
    <div>
      {/* Render data */}
    </div>
  );
}
```

### Önemli Notlar

1. **Client component direktifi**
   - Client component'lerde mutlaka `"use client"` direktifi olmalı
   - Server component'lerde bu direktif olmamalı

2. **Initial data kullanımı**
   - Client component başlangıç state'ini `initialData` ile set edebilir
   - Sonra client-side'da state güncellenebilir (optimistic updates, mutations, etc.)

3. **Hydration**
   - SSR'den gelen data ile client component hydrate olur
   - İlk render'da data zaten mevcut olur (boş ekran + loading olmaz)

---

## Yeni Sayfa/Feature Eklerken

### Adım 1: Server API Fonksiyonu Oluştur

```typescript
// shared/api/server/feature.ts
import { serverFetch } from "./server-fetch";
import { getCurrentSession } from "./session";

export interface FeatureData {
  // Type definitions
}

export async function getFeatureData(params: {
  workspaceSlug: string;
}): Promise<FeatureData | null> {
  const session = await getCurrentSession();
  
  if (!session) {
    return null;
  }
  
  // Find workspace, fetch data, etc.
  const workspace = session.ownerWorkspaces
    .concat(session.memberWorkspaces)
    .find(ws => ws.slug === params.workspaceSlug);
  
  if (!workspace) {
    return null;
  }
  
  // Fetch feature-specific data
  const data = await serverFetch<FeatureData>(
    `/workspaces/${workspace.id}/feature-endpoint`
  );
  
  return data;
}
```

### Adım 2: Route Entry Oluştur

```typescript
// app/[locale]/[workspace]/feature/page.tsx
import { redirect } from "next/navigation";
import { getFeatureData } from "@/shared/api/server/feature";
import { FeaturePage } from "@/features/feature/pages/feature-page";

interface PageProps {
  params: Promise<{ locale: string; workspace: string }>;
}

export default async function FeatureRoute({ params }: PageProps) {
  const { workspace } = await params;
  
  const data = await getFeatureData({ workspaceSlug: workspace });
  
  if (!data) {
    redirect("/not-found");
  }
  
  return <FeaturePage initialData={data} />;
}
```

### Adım 3: Client Component Oluştur

```typescript
// features/feature/pages/feature-page.tsx
"use client";

import type { FeatureData } from "@/shared/api/server/feature";

interface FeaturePageProps {
  initialData: FeatureData;
}

export function FeaturePage({ initialData }: FeaturePageProps) {
  return (
    <div>
      {/* Render feature UI */}
    </div>
  );
}
```

---

## Yaygın Hatalar ve Çözümleri

### ❌ Hata 1: Server component'te client hook kullanmak

```typescript
// YANLIŞ
export default async function Page() {
  const router = useRouter(); // ❌ Server component'te hook kullanılamaz
  // ...
}
```

**Çözüm:**
```typescript
// DOĞRU
import { redirect } from "next/navigation";

export default async function Page() {
  redirect("/path"); // ✅ Server-side redirect
}
```

### ❌ Hata 2: Client component'te server API çağırmak

```typescript
// YANLIŞ
"use client";

export function Page() {
  const data = await getWorkspaceDashboardData({ workspaceSlug }); // ❌
  // ...
}
```

**Çözüm:**
```typescript
// DOĞRU - Server component'te
export default async function PageRoute({ params }: PageProps) {
  const data = await getWorkspaceDashboardData({ workspaceSlug }); // ✅
  return <Page initialData={data} />;
}

// Client component'te
"use client";
export function Page({ initialData }: { initialData: Data }) {
  // ✅ initialData kullan
}
```

### ❌ Hata 3: Cookie'lere doğrudan erişmek

```typescript
// YANLIŞ
import { cookies } from "next/headers";
const token = cookies().get("access_token"); // ❌ Her yerde tekrar etme
```

**Çözüm:**
```typescript
// DOĞRU
import { serverFetch } from "@/shared/api/server/server-fetch";
// ✅ serverFetch otomatik olarak token'ı alır
```

### ❌ Hata 4: `params`'ı await etmemek

```typescript
// YANLIŞ
export default async function Page({ params }: PageProps) {
  const { workspace } = params; // ❌ params Promise
}
```

**Çözüm:**
```typescript
// DOĞRU
export default async function Page({ params }: PageProps) {
  const { workspace } = await params; // ✅ await params
}
```

---

## Checklist: Yeni SSR Sayfası Eklerken

- [ ] Server API fonksiyonu oluşturuldu mu? (`shared/api/server/*.ts`)
- [ ] Route entry async server component mi? (`app/.../page.tsx`)
- [ ] `params` await edildi mi?
- [ ] Error handling yapıldı mı? (redirect if not found)
- [ ] Client component `"use client"` direktifi var mı?
- [ ] `initialData` prop'u geçildi mi?
- [ ] Type definitions doğru mu?
- [ ] Lint hatası var mı?

---

## Örnekler

### Basit SSR Sayfası

```typescript
// app/[locale]/[workspace]/settings/page.tsx
import { redirect } from "next/navigation";
import { getWorkspaceSettingsData } from "@/shared/api/server/settings";
import { SettingsPage } from "@/features/settings/pages/settings-page";

interface PageProps {
  params: Promise<{ locale: string; workspace: string }>;
}

export default async function SettingsRoute({ params }: PageProps) {
  const { workspace } = await params;
  
  const data = await getWorkspaceSettingsData({ workspaceSlug: workspace });
  
  if (!data) {
    redirect("/not-found");
  }
  
  return <SettingsPage initialData={data} />;
}
```

### SSR ile Data Fetching + Client-side Updates

```typescript
// Client component
"use client";

export function SettingsPage({ initialData }: { initialData: SettingsData }) {
  const [settings, setSettings] = useState(initialData);
  
  const handleUpdate = async () => {
    // Client-side mutation
    const updated = await updateSettings(settings);
    setSettings(updated);
  };
  
  return (
    <div>
      {/* Render settings */}
      <button onClick={handleUpdate}>Update</button>
    </div>
  );
}
```

---

## Son Notlar

- **SSR = Server-Side Rendering**: İlk HTML response'unda data mevcut
- **Client-side interactivity**: SSR'den sonra client component'lerde state güncellemeleri yapılabilir
- **Pattern tutarlılığı**: Tüm yeni sayfalar bu pattern'i takip etmeli
- **Type safety**: TypeScript type'ları doğru tanımlanmalı

---

**Son güncelleme:** SSR Paket A tamamlandıktan sonra oluşturuldu.

