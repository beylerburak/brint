# Tiny Steps List

Bu doküman, projedeki tüm **Tiny Step (TS)** adımlarının özetini içerir.

- Her TS **tek başına uygulanabilir** olmalıdır.
- Her TS’nin altında bir **Test** maddesi vardır; bu sağlanmadan TS tamamlanmış sayılmaz.
- Detaylı mimari kurallar için:
  - `docs/dev-workflow.md`
  - `docs/backend-architecture.md`
  - `docs/frontend-architecture.md`
  - `docs/auth-claims-i18n.md`
  dosyaları kullanılacaktır.

---

## 0. Dokümantasyon İskeleti

### TS-00 – `docs/` klasörü iskeleti

**Amaç:**  
Proje kurallarının ve mimarinin tanımlanacağı temel doküman yapısını oluşturmak.

**İçerik:**

- `docs/README.md`
- `docs/dev-workflow.md`
- `docs/tiny-steps.md`
- `docs/backend-architecture.md`
- `docs/frontend-architecture.md`
- `docs/auth-claims-i18n.md`

**Test:**

- Tüm dosyalar repo içinde mevcut mu?
- Cursor/AI’den bu dosyaları özetlemesini isteyince bulup okuyabiliyor mu (boş/skeleton bile olsa)?

---

## A. Root & Monorepo Altyapısı

### TS-01 – Monorepo iskeleti (pnpm / turbo / base config)

**Amaç:**  
pnpm/turbo tabanlı monorepo yapısını kurmak ve `apps/api` + `apps/web` iskeletini açmak.

**Test:**

- `pnpm install` hatasız çalışıyor mu?
- `pnpm lint` ve `pnpm build` (dummy script’ler) hata vermeden çalışıyor mu?

---

### TS-02 – `.gitignore` + `.cursorrules`

**Amaç:**  
Gereksiz dosyaları repo dışında tutmak ve Cursor/AI için global kuralları tanımlamak.

**Test:**

- `.gitignore` içinde `node_modules`, `.next`, `dist`, `*.env` vb. tanımlı mı?
- Cursor’a `.cursorrules`’u okutunca içeriğini özetleyebiliyor mu?

---

### TS-03 – Docker Compose (Postgres + Redis + Adminer/pgAdmin)

**Amaç:**  
Veritabanı ve cache servislerini Docker üzerinden standart şekilde ayağa kaldırmak.

**Test:**

- `docker compose up -d` sonrası:
  - Postgres’e bağlanabiliyor musun? (psql veya Adminer/pgAdmin arayüzü)
  - Redis’e `redis-cli ping` → `PONG` alıyor musun?
- DB UI üzerinden veritabanına erişebiliyor musun?

---

### TS-04 – Ortak dev/test script’leri

**Amaç:**  
Backend ve frontend’i tek komutla çalıştırmak ve testleri koşturmak için script’ler eklemek.

**Test:**

- `pnpm dev` (veya belirlenen alias) ile hem `apps/api` hem `apps/web` dev modda çalışıyor mu?
- `pnpm test` veya `scripts/test-all` ile temel test komutları koşturulabiliyor mu? (şimdilik boş bile olabilir, sadece komutlar patlamasın)

---

## B. Backend Infra: Config, Logger, Error Handling, Cache, Swagger

### TS-05 – Minimal HTTP server + basic health

**Amaç:**  
Backend için en basit HTTP server’ı ve temel health endpoint’ini ayağa kaldırmak.

**Test:**

- `pnpm dev:api` ile server ayağa kalkıyor mu?
- `/health/basic` endpoint’i 200 ve `{ "status": "ok" }` benzeri bir çıktı döndürüyor mu?

---

### TS-06 – `env` validation (Zod) + `.env.example`

**Amaç:**  
Tüm konfigürasyonu `env` üzerinden yönetmek ve eksik/env yanlışlarını erken yakalamak.

**Test:**

- Zorunlu env’lerden biri eksikken server başlatıldığında anlamlı bir hata veriyor mu?
- `.env.example` içinde ihtiyaç duyulan bütün env değişkenleri listelenmiş mi?

---

### TS-07 – App config layer (hardcode killer)

**Amaç:**  
Magic string ve hardcoded değerleri ortadan kaldırmak için konfigürasyon katmanı oluşturmak.

**Test:**

- `src/config/app.config.ts`, `security.config.ts`, `cache.config.ts`, `upload.config.ts` dosyaları mevcut mu?
- Küçük bir debug route veya unit test ile env değişince config çıktısı da değişiyor mu?

---

### TS-08 – Logger altyapısı (pino/winston) + HTTP logging

**Amaç:**  
Tüm loglamayı tek noktadan yönetmek ve HTTP request’leri otomatik loglamak.

**Test:**

- `/health/basic` çağrıldığında terminalde structured log (method, path, status, duration) görünüyor mu?
- Logger başka bir dosyada import edildiğinde aynı instance’ı kullanıyor mu?

---

### TS-09 – Global error handler (exception filter)

**Amaç:**  
Backend içinde fırlayan tüm hataları yakalayarak standart JSON formatında döndürmek.

**Test:**

- Bilerek `throw new Error('test')` atan bir route yaz:
  - Response şu formata yakın mı?
    ```json
    {
      "success": false,
      "error": {
        "code": "INTERNAL_ERROR",
        "message": "..."
      }
    }
    ```
  - Logger içinde stack trace görünüyor mu?

---

### TS-10 – Redis client wrapper + cache service

**Amaç:**  
Redis bağlantısını soyutlayıp domain katmanından bağımsız bir cache servisi sağlamak.

**Test:**

- `/debug/cache` benzeri bir route:
  - `set('test', '123')`
  - `get('test')`
  - `del('test')`
- Redis kapalıyken graceful hata ve anlamlı log alınıyor mu?

---

### TS-11 – Full health check (DB + Redis + build info)

**Amaç:**  
Uygulamanın tüm kritik bağımlılıklarının durumunu tek endpoint’te göstermek.

**Test:**

- `/health/full`:
  - DB bağlıyken OK,
  - Redis/DB kapanınca `degraded` veya 500 dönüyor mu?
- Response içinde versiyon ve (varsa) git commit bilgisi görünüyor mu?

---

### TS-12 – Swagger / OpenAPI iskeleti

**Amaç:**  
Backend API’yi Swagger/OpenAPI üzerinden keşfedilebilir ve test edilebilir hale getirmek.

**Test:**

- `/docs` adresi Swagger UI gösteriyor mu?
- Swagger’dan `/health/basic` ve `/health/full` çağrılabiliyor mu?

---

## C. Backend Domain & Auth/Claims Skeleton

### TS-13 – Katmanlı modül klasör yapısı

**Amaç:**  
Backend için katmanlı mimariyi (core + modules + domain/application/infrastructure/presentation) kurmak.

**Test:**

- `core` ve `modules/*` klasörleri oluşturulmuş mu?
- TypeScript build çalıştığında klasör yapısı yüzünden hata veriyor mu? (vermemeli)

---

### TS-14 – Prisma entegrasyonu + ilk migration (User, Workspace)

**Amaç:**  
Prisma ile DB bağlantısını kurmak ve temel modelleri (User, Workspace, WorkspaceMember) tanımlamak.

**Test:**

- `npx prisma migrate dev` sorunsuz çalışıyor mu?
- Adminer/pgAdmin üzerinden tabloları görebiliyor musun?

---

### TS-15 – User & Workspace domain entity skeleton’ları

**Amaç:**  
User ve Workspace için domain entity’lerini tanımlamak (iş kuralları seviyesinde).

**Test:**

- Unit test ile:
  - Geçersiz email/slug ile entity oluşturma denemesi hata veriyor mu?
  - Geçerli parametrelerle instance başarılı oluşuyor mu?

---

### TS-16 – Token service skeleton

**Amaç:**  
JWT üretme ve doğrulama işini merkezi bir servis ile çözmek.

**Test:**

- Unit test:
  - Payload → `signAccessToken` → `verifyAccessToken` → aynı payload geri geliyor mu?
  - Expiry config’ten doğru okunuyor mu?

---

### TS-17 – Auth context middleware (JWT + Workspace/Brand headers)

**Amaç:**  
Her request’te user + workspace + brand context’ini oluşturmak.

**Test:**

- `/debug/auth` route’u:
  - Authorization header + `X-Workspace-Id` + `X-Brand-Id` gönderdiğinde response’da beklenen `auth` objesi var mı?
- Log’larda `userId` ve `workspaceId` görünüyor mu (varsa)?

---

### TS-18 – Role & Permission (claims) DB modeli

**Amaç:**  
Role, Permission ve RolePermission tablolarını oluşturup workspace bazlı yetki modelini hazırlamak.

**Test:**

- Migration başarılı mı?
- Seed sonrası:
  - En az 1 workspace, 2 role, 5–6 permission DB’de mevcut mu?
  - Adminer/pgAdmin’den ilişkiler doğru görünüyor mu?

---

### TS-19 – Permission registry (config)

**Amaç:**  
Tüm permission key’lerini merkezi bir registry üzerinden yönetmek.

**Test:**

- `permissions.registry.ts` içinde:
  - `workspace:settings.view`, `workspace:members.manage`,  
    `studio:brand.view`, `studio:brand.create`,  
    `studio:content.create`, `studio:content.publish` vb. tanımlı mı?
- Unit test:
  - Duplicate key yok mu?
  - TS tarafında permission key’leri type-safe kullanılabiliyor mu?

---

### TS-20 – Permission resolver service

**Amaç:**  
User + Workspace kombinasyonu için efektif permission list’ini hesaplamak.

**Test:**

- Seed edilmiş veriye göre unit test:
  - Belirli bir user + workspace için beklenen permission list dönüyor mu?

---

### TS-21 – `requirePermission` middleware

**Amaç:**  
Endpoint seviyesinde permission kontrolünü standartlaştırmak.

**Test:**

- `/debug/protected` route:
  - `requirePermission('workspace:settings.view')` ile korunmuş olsun.
- İzinli user → 200, izinsiz user → 403 dönüyor mu?
- Log’larda hangi user hangi permission’da takılmış görünüyor mu?

---

### TS-21.5 – DB’de Session tablosu + session service

1. Önce genel fikir: Ne yapıyoruz, neyi yapmıyoruz?
	•	Google OAuth primary, magic link fallback → Buna ben de katılıyorum. B2B için cuk oturuyor.
	•	Refresh / access token → Biz zaten TS-16 ile bunu hazırladık:
	•	Access token payload: { sub, wid?, bid?, type: 'access' }
	•	Refresh token payload: { sub, tid, type: 'refresh' }
	•	Claude’un dediği permissions[] payload’a gömmeyi önermiyorum:
	•	Zaten TS-20 ile permissionService + requirePermission yazdık.
	•	Permission’ı DB’den hesaplıyoruz; JWT içine permission list itmeye gerek yok (cache’lemek istersen ayrı story).
	•	Bizim stack’te kritik olan şu:
	•	Refresh token payload’ında tid var → bu aslında Session ID gibi.
	•	Yani Session modelini buna göre kurarsak hem temiz hem minimum refactor ile ilerleriz.

Bu nedenle TS-21.5’te:
	•	Sadece backend tarafında Session modeli + session service + repository yapıyoruz.
	•	Henüz:
	•	/auth/google
	•	/auth/refresh
	•	/auth/logout
	•	/auth/login/magic-link
yok → onlar TS-22’den sonra gelecek ayrı tiny steps (TS-AUTH-0x gibi).

Özet:
TS-21.5 = “DB’de Session tablosu + session service”
Login/OAuth flow’u sonra.

⸻

2. Modeli netleştirelim (bizim gerçek kurgumuz)

Session nasıl olsun?

Benim önerim (mevcut koduna göre en uyumlu hali):
	•	Session.id = refresh token içindeki tid
	•	Yani refresh token payload’ındaki tid ile DB’deki Session id birebir eşleşsin.
	•	Ayrıca token’ı komple DB’ye yazmıyoruz → sadece id ve meta bilgiler.
	•	Şimdilik token hash eklemiyoruz:
	•	İleride istersen ekleriz (tokenHash column).
	•	Şu anki tasarımda JWT signature + tid + DB check zaten çok güvenli.
	•	Ömür yönetimi:
	•	expiresAt → now + REFRESH_TOKEN_EXPIRES_IN_DAYS
	•	Bu config zaten var: authConfig.refreshToken.expiresInDays.

Prisma modeli önerisi

model Session {
  id           String   @id            // refresh token payload'daki `tid` ile birebir
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  expiresAt    DateTime
  userAgent    String?
  ipAddress    String?
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())

  @@map("sessions")
  @@index([userId, expiresAt])
}

Ve User modeline:

model User {
  // ...
  sessions      Session[]
}

Not: googleId, avatar gibi alanları şimdi eklemiyoruz. Onlar Google OAuth tiny steps’te gelecek; TS-21.5’i küçük tutuyoruz.


---

### TS-21.x – Auth & Session Extensions

- TS-21.5 – Session model & service
- TS-21.6 – Brand & Brand Studio domain skeleton (backend only)
- TS-21.7 – Google OAuth endpoints (auth/google, auth/google/callback)
- TS-21.8 – Refresh & Logout endpoints (auth/refresh, auth/logout)
- TS-21.9 – Magic link fallback (Redis + email stub)


---


### TS-22 – Brand & Brand Studio domain skeleton

**Amaç:**  
Brand entity’sini ve Brand Studio’ya erişim kurallarını tanımlayan domain servisini oluşturmak.

**Test:**

- Unit test:
  - Brand oluşturma invariants (slug, workspace ilişkisi) çalışıyor mu?
  - `studio-access.service` içinde member/non-member/suspended senaryoları doğru sonuç veriyor mu?

---

### TS-23 – Brand Studio sample endpoint

**Amaç:**  
Brand Studio için ilk gerçek endpoint’i oluşturmak (ör: erişilebilir brand listesi).

**Test:**

- `/studio/brands` GET:
  - Auth + `X-Workspace-Id` + `requirePermission('studio:brand.view')` ile korunmuş mu?
- Seed senaryosuna göre:
  - User sadece erişebildiği brand’leri alıyor mu?
- Swagger’da endpoint tanımlı ve çalışır durumda mı?

---

## D. Frontend Foundation: Next.js, i18n, ShadCN, Theme/Dark Mode

### TS-24 – Next.js App Router iskeleti (TS)

**Amaç:**  
Frontend için Next.js App Router ve temel route’ları kurmak.

**Test:**

- `pnpm dev:web`:
  - `/login` ve `/[workspaceSlug]` sayfaları açılıyor mu?
  - TypeScript hatası var mı?

---

### TS-25 – i18n kütüphanesi kurulumu

**Amaç:**  
Frontend tarafında `tr` ve `en` locale’leriyle i18n altyapısını kurmak.

**Test:**

- `src/locales/tr/common.json` ve `src/locales/en/common.json` mevcut mu?
- `/login` sayfasında bir metin locale’e göre değişiyor mu?

---

### TS-26 – Locale bazlı routing stratejisi

**Amaç:**  
URL’leri locale-aware yapmak: `/[locale]/login`, `/[locale]/[workspaceSlug]/...`.

**Test:**

- `/tr/login` ve `/en/login` farklı dilde render oluyor mu?
- Route param’ları (locale + workspaceSlug) layout hiyerarşisinde doğru akıyor mu?

---

### TS-27 – ShadCN init (New York style + accent)

**Amaç:**  
ShadCN UI kütüphanesini New York tasarımı ve seçilen accent rengi ile projeye entegre etmek.

**Test:**

- Örnek `Button` component’i ShadCN stilinde render oluyor mu?
- Tailwind config ShadCN dökümantasyonu ile uyumlu mu?

---

### TS-28 – Dark mode altyapısı (class-based)

**Amaç:**  
Tema geçişini `class` tabanlı dark mode stratejisi ile yönetmek.

**Test:**

- `darkMode: 'class'` ayarlı mı?
- Body’e `class="dark"` verdiğinde komponentler dark theme’e geçiyor mu?

---

### TS-29 – Theme toggle + persist (localStorage/cookie)

**Amaç:**  
Kullanıcının tema seçimini (light/dark) toggle komponenti ile alıp kalıcı hale getirmek.

**Test:**

- Toggle’a basınca tema değişiyor mu?
- Sayfa yenilendiğinde son seçilen tema korunuyor mu?

---

### TS-30 – Frontend config layer (env-free)

**Amaç:**  
Frontend konfigürasyonunu tek bir yerden yönetmek ve doğrudan `process.env` kullanımını engellemek.

**Test:**

- `src/shared/config/app.ts` içinde `apiBaseUrl`, `defaultLocale`, `supportedLocales` tanımlı mı?
- Bir component’te bu config’leri loglayınca doğru değerler geliyor mu?

---

## E. Frontend UX Infra: HTTP, Auth, Forms, Toast, Error Boundary

### TS-31 – HTTP client wrapper + minimal logging

**Amaç:**  
Backend ile konuşmak için ortak bir HTTP client oluşturmak.

**Test:**

- `http-client` ile backend `/health/full` çağrılıp UI’da gösterilebiliyor mu?
- Hata durumunda client standard bir error objesi üretiyor mu?

---

### TS-32 – Auth & Workspace context (i18n aware)

**Amaç:**  
Kullanıcı ve workspace bilgisini context ile yönetmek.

**Test:**

- Mock login sonrası:
  - `AuthProvider` içinde user bilgisi tutuluyor mu?
  - Workspace seçimi `WorkspaceProvider` içinde state olarak korunuyor mu?
- UI’da bu bilgiler doğru yansıyor mu?

---

### TS-33 – Permission hooks + `PermissionGate`

**Amaç:**  
Frontend’de permission bazlı görünürlük kontrolü yapmak.

**Test:**

- `useHasPermission('studio:content.create')` doğru boolean döndürüyor mu?
- `PermissionGate` ile sarılmış buton:
  - permission varsa görünüyor,
  - yoksa fallback davranışı sergiliyor mu?

---

### TS-34 – Form altyapısı (React Hook Form + Zod)

**Amaç:**  
Tüm formlar için standardize edilmiş validation ve form state yönetimi sağlamak.

**Test:**

- Örnek `LoginForm`:
  - Zod schema ile validation yapıyor mu?
  - Yanlış email formatında client-side error mesajı gösteriyor mu?

---

### TS-35 – Toast / Notification system

**Amaç:**  
Kullanıcıya işlem sonuçları ve hatalar için görsel geri bildirim sağlamak.

**Test:**

- Root layout’ta `Toaster` tanımlı mı?
- Bir buton üzerinden `toast.success('İşlem başarılı')` tetiklenebiliyor mu?

---

### TS-36 – Global Error Boundary (frontend)

**Amaç:**  
React component tree içinde oluşan hataları yakalayıp uygulamayı beyaz ekrana düşürmeden yönetmek.

**Test:**

- Bilerek `throw` eden bir component:
  - Uygulama tamamen çökmüyor mu?
  - Global Error UI gösteriliyor mu?

---

### TS-37 – Brand Studio routing skeleton (locale + workspace-first)

**Amaç:**  
Brand Studio uygulamasının route yapısını kurmak.

**Test:**

- `/[locale]/[workspaceSlug]/studio` → brand seçme ekranı (dummy de olsa).
- `/[locale]/[workspaceSlug]/studio/[brandSlug]/dashboard` → boş dashboard.
- URL değiştirdikçe locale/workspace/brand context’leri doğru şekilde güncelleniyor mu?

---

## F. Dokümantasyon & AI Guardrails

### TS-38 – `docs/backend-architecture.md`

**Amaç:**  
Backend mimarisini (katmanlı yapı, config, logger, cache, Swagger, Auth/Claims) belgelemek.

**Test:**

- Cursor’a “Backend mimarisini özetle” dediğinde bu dosyadan referans alarak mantıklı bir özet yapabiliyor mu?

---

### TS-39 – `docs/frontend-architecture.md`

**Amaç:**  
Frontend mimarisini (Next.js, i18n, ShadCN, feature-based yapı, HTTP client, forms, toast, error boundary) belgelemek.

**Test:**

- Cursor’a “Yeni bir Brand Studio ekranı ekle” dediğinde bu dokümandaki pattern’lere uyuyor mu?

---

### TS-40 – `docs/auth-claims-i18n.md`

**Amaç:**  
Auth, claims, role/permission modeli ve i18n kurallarını netleştirmek.

**Test:**

- Cursor’a “Protected bir endpoint ve karşılık gelen UI yaz” dediğinde:
  - Backend’de doğru permission kontrolünü,
  - Frontend’de `PermissionGate` ve `t()` kullanımını yapıyor mu?

---

### TS-41 – `docs/dev-workflow.md` (Tiny Step çalışma kuralı)

**Amaç:**  
Projede AI ile nasıl çalışılacağını, Tiny Step metodolojisini ve test disiplinini tarif etmek.

**Test:**

- Cursor’a yeni bir chat’te:
  - “Proje `docs/` klasöründe tanımlı. Önce `dev-workflow` ve ilgili mimari dokümanları oku.” dediğinde,
  - Bu dosyaları referans alarak çalışmaya başlıyor mu?

---

M-01 – Storage config & env vars (S3)
	•	env.ts + config/index.ts içine sadece config tanımları:
	•	AWS_REGION
	•	AWS_ACCESS_KEY_ID
	•	AWS_SECRET_ACCESS_KEY
	•	S3_MEDIA_BUCKET
	•	(opsiyonel) S3_PUBLIC_CDN_URL
	•	storageConfig objesi:
	•	bucket, region, baseUrl vs.
	•	Kod içinde “bucket name string” asla yazılmayacak, hep storageConfig kullanılacak.

M-02 – Storage interface (no implementation yet)
	•	apps/api/src/lib/storage.ts içinde bir interface:

export type PresignedUploadRequest = {
  workspaceId: string;
  brandId?: string;
  contentType: string;
  fileName: string;
  sizeBytes: number;
};

export type PresignedUploadResponse = {
  uploadUrl: string;
  method: 'PUT';
  expiresInSeconds: number;
  objectKey: string;
};

export interface StorageService {
  getPresignedUploadUrl(req: PresignedUploadRequest): Promise<PresignedUploadResponse>;
  getPresignedDownloadUrl(objectKey: string, opts?: { expiresInSeconds?: number }): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
}


	•	Şimdilik sadece interface & TODO; gerçek S3 implementation’ı daha sonra.

M-03 – Key naming strategy (dokümantasyon)
	•	docs/backend-architecture.md altına küçük bir bölüm:
	•	Örn:
/{workspaceId}/{brandId or _}/media/{YYYY}/{MM}/{fileId}-{slug}.{ext}
	•	Sadece doküman; migration yok, kod yok.

Bunlar şu an koşulması gerekmeyen ama planın sonunda durması gereken maddeler.
Ne zaman “media zamanı” dersen, o zaman bunları TS-MEDIA-01, 02, 03 diye Cursor’a verip koştururuz.

⸻

Phase 3 – Search & Command Palette

S-01 – SearchService interface (domain abstraction)
	•	apps/api/src/modules/search/search.service.ts gibi bir yerde:

export type SearchEntityType =
  | 'workspace'
  | 'brand'
  | 'content'
  | 'media'
  | 'task';

export type SearchResultItem = {
  type: SearchEntityType;
  id: string;
  workspaceId: string;
  brandId?: string;
  title: string;
  snippet?: string;
  url: string;
  score: number;
};

export interface SearchService {
  search(query: string, options: {
    workspaceId: string;
    brandId?: string;
    limit?: number;
  }): Promise<SearchResultItem[]>;
}


	•	İlk implementasyon Postgres olabilir, sonra istersen Elasticsearch/Meilisearch.

S-02 – Global search API kontratı (command menu)
	•	Dokümana yazılacak sadece:
	•	Endpoint: GET /search/global?query=...
	•	Response örneği:

{
  "groups": [
    {
      "label": "Brands",
      "items": [ /* SearchResultItem mapped */ ]
    },
    {
      "label": "Contents",
      "items": [ /* ... */ ]
    }
  ]
}


	•	Bu JSON kontratını bilmek, frontend command menüyü tasarlarken işine yarayacak.

S-03 – Engine seçimi (later decision)
	•	Dokümanda not:
	•	“İlk sürüm: Postgres full-text search”
	•	“SCALE sinyali gelirse: Meilisearch / Elasticsearch değerlendirmesi”
	•	Şu anda hiçbir engine kurulmayacak.

⸻

## Diğer

TS-11 (full health) için DB + Prisma geldiğinde geri döneriz.