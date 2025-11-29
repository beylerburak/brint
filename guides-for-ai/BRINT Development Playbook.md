# BRINT Development Playbook

> Amaç:  
> Yeni bir domain, feature, endpoint veya UI geliştirilirken;  
> - multi-tenant,  
> - güvenli,  
> - test edilebilir,  
> - activity/observability entegre,  
> - AI-friendly  
> kalitede geliştirme yapılmasını garanti etmek.

Bu doküman özellikle **Cursor / AI agent** için yazılmıştır.  
Her yeni geliştirmede önce bu rehber okunmalı, ilgili checklist takip edilmelidir.

---

## 1. Genel Mimari Prensipler

### 1.1 Katmanlar

- **Backend (apps/api)**  
  - `src/modules/<domain>/` → domain odaklı modüller  
  - `src/core/*` → auth, queue, realtime, observability vb. core altyapı  
  - `src/lib/*` → generic helper’lar (validation, pagination, logger vb.)  

- **Frontend (apps/web)**  
  - `features/<domain>/` → domain feature’ları (pages, components, hooks, context)  
  - `shared/*` → generic ui, hooks, api, realtime vb.  
  - `app/[locale]/[workspace]/*` → route tanımı + layout

### 1.2 Cross-cutting rehberler (mutlaka bak)

Yeni bir şey yaparken ilgili rehberi kullan:

- `docs/guides-for-ai/tenant-guard.md`
- `docs/guides-for-ai/pagination-standard.md`
- `docs/guides-for-ai/validation-standard.md`
- `docs/guides-for-ai/realtime-websocket.md`
- `docs/guides-for-ai/backend-audit-report.md` (yüksek seviye kalite kriterleri)

Bu playbook, onların üstünde “orkestra dokümanı”dır.

---

## 2. Backend – Yeni Domain Geliştirme Standardı

Yeni bir backend domain’i eklerken aşağıdaki sırayı kullan.

### 2.1 Domain klasör yapısı

`apps/api/src/modules/<domain>/` altında tipik yapı:

- `schema.prisma` tarafında ilgili model(ler)
- `<domain>.types.ts` → domain type’ları
- `<domain>.repository.ts` → Prisma erişimi
- `<domain>.service.ts` → business logic
- `<domain>.routes.ts` → Fastify route’ları (daima `/v1/...` altında)
- (gerekirse) `<domain>.validation.ts` → domain’e özel Zod şemaları
- (ileride) `<domain>.events.ts` → domain event tanımları

**Kural:**

- Repository **sadece DB** bilir (Prisma).
- Service iş kurallarını bilir.
- Routes sadece:
  - input validation,  
  - permission check,  
  - service çağrısı,  
  - activity log,  
  - response mapping  
  yapar.

---

### 2.2 API route ve versioning

- Tüm public API endpoint’leri **`/v1/...`** ile başlar.
- Örnekler:
  - `/v1/studio/brands`
  - `/v1/studio/contents`
  - `/v1/studio/social-accounts`

**Cursor için kural:**

> Yeni bir route eklerken:
> - `apps/api/src/core/http/server.ts` içinde `register<Domain>Routes(app)` ile kaydet.  
> - Route path’leri daima `/v1/...` prefix’iyle başlasın.  
> - Sadece **health** gibi infra endpoint’ler prefix’siz olabilir (`/health/live` gibi).

---

### 2.3 Validation (Zod standardı)

**Her input mutlaka Zod ile validate edilir.**

- Ortak şemalar: `packages/core-validation/src/schemas.ts`
  - `emailSchema`
  - `workspaceIdSchema`
  - `cursorPaginationQuerySchema`
  - `magicLinkRequestSchema`
  - vb.
- Endpoint tarafında:
  - `validateBody(zodSchema, request)`
  - `validateQuery(zodSchema, request.query)`
  - `validateParams(zodSchema, request.params)`

**Kural:**

- JSONException, string/number casting vs. elle yapma.
- Hatalar her zaman `VALIDATION_ERROR` kodu ve standart formatta dönmeli (bkz: `validation-standard.md`).

---

### 2.4 Permission & tenant guard

**Her workspace-scoped endpoint’de:**

1. **Permission guard**:
   - `requirePermission("workspace:settings.manage")` veya ilgili permission key
   - Permission registry: `src/core/auth/permissions.registry.ts` içinde tanımlı olmalı.

2. **Tenant guard**:
   - `X-Workspace-Id` header’ı **zorunlu**  
   - Path’teki `:workspaceId` ile header eşleşmeli  
   - `tenant-guard.md` içindeki pattern’e göre kontrol

**Kural:**

> Yeni domain endpoint’i yazarken:
> - Eğer workspace scoped ise: hem permission, hem tenant guard kullan.  
> - Eğer global / system endpoint ise: bunu dokümana yaz, çok istisna olmalı.

---

### 2.5 Activity log entegrasyonu

Her anlamlı aksiyon **ActivityEvent** olarak loglanmalı.

Örnek event tipleri (zaten var):

- `auth.magic_link_requested`
- `auth.magic_link_login_success`
- `workspace.member_invited`
- `email.magic_link_sent` / `failed`
- `email.workspace_invite_sent` / `failed`

Yeni domain için örnekler:

- `studio.brand_created`
- `studio.brand_updated`
- `studio.content_created`
- `studio.content_publication_scheduled`
- `studio.content_publication_completed`
- …

**Pattern:**

- `ActivityEventType` union’ına yeni event key’ini ekle
- `logActivity({ ... })` ile logla
  - `workspaceId` zorunlu (workspace scoped ise)
  - `userId` → aktör user (yoksa `null` + `actorType: "system"`)
  - `source`: `"api" | "worker" | "system"`
  - `scopeType` / `scopeId` → örn. `"brand"` + brandId
  - `metadata` → AI projection’a yarayacak ham data

> **Kural:**  
> Bir endpoint bir şey create/update/delete ediyorsa,  
> **dönüşten hemen önce** `logActivity()` çağrısı olmalı.

---

### 2.6 Queue (BullMQ) entegrasyonu

Async işler (email, publish job, snapshot vs.) için:

- Yeni job tipi eklerken:
  - Job data tipi `EmailJobData` benzeri union içine eklenir.
  - `enqueue<Something>Job()` helper oluşturulur.
  - Worker içinde `process<Something>Job()` case’i eklenir.
  - Başarılı/başarısız durumlarda **ActivityEvent** yazılır (`Activity Paket C` pattern’i).

> Kural:  
> Request süresi 1–2 saniyeyi geçebilecek her iş **queue** ile yapılmalı,  
> endpoint sadece “job enqueued” sonucu döndürmeli.

---

### 2.7 WebSocket + realtime

Real-time gerektiren her domain olayı için:

- Event tipleri: `apps/api/src/core/realtime/events.ts`
- Broadcast: `publishEvent({ type, workspaceId, payload })`
- Frontend’de:
  - `NotificationsProvider` ile toast / in-app notification
  - İleride `useRealtimeChannel` gibi domain spesifik hook’lar

Örneğin publish job tamamlanınca:

- Backend:
  - `publication.completed` event’ini `publishEvent` ile yolla.
- Frontend:
  - Bu event’i dinle, ilgili content kartını güncelle, toast göster.

---

### 2.8 Testler

Yeni domain / endpoint için **en az**:

- Unit test veya route test
- Cross-tenant access test (workspace-mismatch + missing header senaryoları)
- Pagination varsa: 3 temel test (default, limit sınırı, iki sayfa + overlap yok)

Pattern olarak:

- `workspace-member.routes.spec.ts`
- `workspace-invite.routes.spec.ts`
- `auth.routes.spec.ts`

dosyalarını referans al.

---

### 2.9 Dokümantasyon

Her yeni domain / endpoint:

- Swagger/OpenAPI’de tanımlanmalı.
- Geliştirme sırasında:
  - Eğer yeni cross-cutting pattern (örn. yeni bir standard) getiriyorsa:
    - `docs/guides-for-ai/<yeni-guide>.md` oluştur.
    - `backend-architecture.md` içine referans ekle.

---

## 3. Frontend – Yeni Domain Geliştirme Standardı

### 3.1 Klasör yapısı

Yeni domain örneği: **Brand Studio**

- `apps/web/features/studio/brands/`
  - `pages/brands-page.tsx`
  - `components/brand-table.tsx`
  - `components/brand-form.tsx`
  - `hooks/use-brands-query.ts`
  - `hooks/use-brand-mutations.ts`
  - `api/brands-api.ts` (opsiyonel, ya da `shared/api` altı)
- `apps/web/app/[locale]/[workspace]/studio/brands/page.tsx`
  - Sadece **route entry** ve `BrandsPage` render eder.

**Kural:**

> `app/*` sadece routing/layout.  
> Asıl mantık daima `features/*` altında.

---

### 3.2 API client ve error handling

Backend `/v1/...` endpoint’leri için:

- Ortak HTTP client → `shared/api/http-client.ts` (veya mevcut yapın neyse)
- Tüm istekler:
  - `X-Workspace-Id` otomatik eklenmeli (workspace context’ten)
  - Hata formatı validation standardına göre parse edilmeli
  - Auth error’larında: login ekranına yönlendirme / toast

---

### 3.3 State & hooks

Her domain için:

- **Query hook’ları**:
  - `useBrandsQuery`, `useBrand(id)` gibi
- **Mutation hook’ları**:
  - `useCreateBrand`, `useUpdateBrand`, `useDeleteBrand`, `useInviteMember` vs.

**Kural:**

> Sayfa component’i **mümkün olduğunca “dumb UI”** olsun,  
> iş mantığı hooks + service katmanında kalsın.

---

### 3.4 UI pattern’leri

- ShadCN UI + kendi design system’ine uygun component’ler
- Reusable:
  - `DataTable`, `Form`, `Dialog`, `Drawer`, `Toast`, `EmptyState` vb.

---

### 3.5 Realtime & notifications

- Workspace layout zaten `NotificationsProvider` ile wrap edilmiş durumda.
- Domain spesifik toast’lar:
  - WS event geldiğinde
  - veya mutation success/fail durumunda

Örneğin:

- “Yeni brand eklendi”
- “İçerik yayınlandı”
- “Yayınlama job’u başarısız oldu, Activity log’a bak”

---

## 4. Yeni Feature / Domain İçin Cursor Checklist’i

Bunu doğrudan Cursor’a verebileceğin bir şablon olarak düşün:

```text
GÖREV: Yeni bir domain/feature geliştir: <DOMAIN_ADI_KOY>

1) ANALİZ
- apps/api/ARCHITECTURE.md ve docs/guides-for-ai/*.md dosyalarını oku:
  - tenant-guard.md
  - validation-standard.md
  - pagination-standard.md
  - realtime-websocket.md
  - backend-architecture.md
  - development-playbook.md (bu dosya)
- İlgili benzer domain’leri incele (ör: workspace-member, workspace-invite).

2) BACKEND
- schema.prisma içine gerekli model(leri) ekle.
- Uygun migration oluştur (create-only, SQL dosyası).
- apps/api/src/modules/<domain>/ klasörünü oluştur:
  - <domain>.types.ts
  - <domain>.repository.ts
  - <domain>.service.ts
  - <domain>.routes.ts
- Input validation:
  - Gerekli Zod şemalarını packages/core-validation/src/schemas.ts içine ekle.
  - Endpoint’lerde validateBody / validateQuery / validateParams kullan.
- Permission & tenant guard:
  - permissions.registry.ts içine gerekli permission key’lerini ekle.
  - Tüm workspace-scoped endpoint’lere requirePermission ve tenant guard uygula.
- Activity log:
  - ActivityEventType union’ına yeni event type’larını ekle.
  - Başarılı create/update/delete ve önemli sistem aksiyonlarında logActivity çağır.
- Queue & worker gerekiyorsa:
  - Mevcut BullMQ pattern’lerini (email.queue.ts) referans al.
  - İşlerin hem success hem failure senaryolarında ActivityEvent yaz.
- WebSocket gerekiyorsa:
  - core/realtime/events.ts içine event type ekle.
  - publishEvent ile workspace bazlı event yayınla.

3) TESTLER
- Yeni endpoint’ler için route test’leri yaz:
  - Mutlu path
  - Validation error
  - Permission / tenant guard (403/401)
  - Varsa pagination senaryoları
- Testler Vitest ile, mevcut workspace-member/workspace-invite testlerini referans al.

4) FRONTEND
- apps/web/features/<domain>/ altında feature klasörü oluştur.
- app/[locale]/[workspace]/... altında route dosyası ekle ve ilgili page component’ini render et.
- API çağrılarını shared/http veya domain özel api dosyasında implement et.
- Query & mutation hook’larını yaz (React Query veya mevcut pattern’e göre).
- UI component’lerini ShadCN + mevcut design system’e uygun şekilde yaz.

5) DOKÜMANTASYON
- Swagger/OpenAPI dokümantasyonunu güncelle.
- Eğer yeni bir pattern/standard eklediysen:
  - docs/guides-for-ai altında yeni bir rehber oluştur.
  - ARCHITECTURE.md içinde buna referans ekle.

6) KALİTE KONTROL
- pnpm lint
- pnpm test:api
- Lokal ortamda en az bir mutlu path akışını manuel test et.