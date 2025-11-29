# Brand Domain Documentation

Bu doküman, BRINT projesinde **Brand Domain v1** implementasyonunu, API endpoint'lerini, veri modellerini, permission'ları ve activity event'lerini açıklar.

---

## 1. Overview

Brand domain, BRINT'in **Brand Studio** özelliğinin temelini oluşturur. Her workspace birden fazla brand oluşturabilir ve her brand için:

- **Profil bilgileri** (name, description, industry, tone of voice vb.)
- **Wizard/readiness tracking** (profileCompleted, socialAccountConnected, publishingDefaultsConfigured)
- **Hashtag preset'leri** (brand-level hashtag grupları)
- **Publishing defaults** (ileride: varsayılan paylaşım ayarları)

yönetilebilir.

### Amaçlar

1. Brand profili oluşturma ve yönetme
2. Readiness score ile brand setup wizard'ını takip etme
3. Brand-level hashtag preset'leri yönetme
4. Tüm aksiyonları activity log'a kaydetme
5. Multi-tenant güvenlik ile workspace izolasyonu sağlama

---

## 2. Data Model

### 2.1 Brand Modeli

```prisma
model Brand {
  id          String    @id @default(cuid())
  workspaceId String
  name        String
  slug        String
  description String?
  industry    String?
  language    String?           // "tr", "en" etc.
  timezone    String?           // IANA timezone
  toneOfVoice String?           // friendly, corporate, etc.

  // Wizard / readiness
  profileCompleted              Boolean @default(false)
  hasAtLeastOneSocialAccount    Boolean @default(false)
  publishingDefaultsConfigured  Boolean @default(false)
  readinessScore                Int     @default(0)     // 0-100

  // Brand-level settings
  primaryColor    String?       // "#RRGGBB"
  secondaryColor  String?
  websiteUrl      String?
  logoMediaId     String?

  isArchived  Boolean   @default(false)
  isActive    Boolean   @default(true)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  workspace      Workspace            @relation(...)
  hashtagPresets BrandHashtagPreset[]
  // ... other relations
}
```

#### Readiness Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `profileCompleted` | Boolean | Profil bilgileri tamamlandı mı? |
| `hasAtLeastOneSocialAccount` | Boolean | En az bir sosyal hesap bağlı mı? |
| `publishingDefaultsConfigured` | Boolean | Varsayılan yayın ayarları yapıldı mı? |
| `readinessScore` | Int (0-100) | Toplam hazırlık skoru |

### 2.2 BrandHashtagPreset Modeli

```prisma
model BrandHashtagPreset {
  id          String   @id @default(cuid())
  workspaceId String
  brandId     String
  name        String
  tags        Json     // JSONB: string[] of hashtags
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(...)
  brand     Brand     @relation(...)
}
```

### 2.3 Content & Publication Modelleri

Bu modeller schema'da tanımlı, ancak API endpoint'leri henüz implementasyona dahil değil (sonraki sprint).

```prisma
model Content {
  id          String   @id @default(cuid())
  workspaceId String
  brandId     String
  title       String
  baseCaption String?
  // ...
}

model Publication {
  id          String   @id @default(cuid())
  workspaceId String
  brandId     String
  contentId   String
  platform    PublicationPlatform
  contentType PublicationContentType
  status      PublicationStatus
  settings    Json
  // ...
}
```

---

## 3. Permissions

### Permission Keys

#### Brand Permissions
| Key | Açıklama |
|-----|----------|
| `studio:brand.view` | Brand listesini ve detaylarını görüntüleme |
| `studio:brand.create` | Yeni brand oluşturma |
| `studio:brand.update` | Brand profilini güncelleme |
| `studio:brand.delete` | Brand'i arşivleme/silme |
| `studio:brand.manage_social_accounts` | Sosyal hesapları yönetme (future) |
| `studio:brand.manage_publishing_defaults` | Yayın varsayılanlarını yönetme |

#### Content Permissions
| Key | Açıklama |
|-----|----------|
| `studio:content.view` | Content görüntüleme |
| `studio:content.create` | Content oluşturma |
| `studio:content.update` | Content güncelleme |
| `studio:content.delete` | Content silme |
| `studio:content.publish` | Content yayınlama |
| `studio:content.manage_publications` | Publication'ları yönetme |

### Rol → Permission Matrisi

| Permission | OWNER | ADMIN | EDITOR | VIEWER |
|------------|-------|-------|--------|--------|
| `studio:brand.view` | ✅ | ✅ | ✅ | ✅ |
| `studio:brand.create` | ✅ | ✅ | ✅ | ❌ |
| `studio:brand.update` | ✅ | ✅ | ✅ | ❌ |
| `studio:brand.delete` | ✅ | ✅ | ❌ | ❌ |
| `studio:brand.manage_social_accounts` | ✅ | ✅ | ✅ | ❌ |
| `studio:brand.manage_publishing_defaults` | ✅ | ✅ | ✅ | ❌ |
| `studio:content.view` | ✅ | ✅ | ✅ | ✅ |
| `studio:content.create` | ✅ | ✅ | ✅ | ❌ |
| `studio:content.update` | ✅ | ✅ | ✅ | ❌ |
| `studio:content.delete` | ✅ | ✅ | ✅ | ❌ |
| `studio:content.publish` | ✅ | ✅ | ✅ | ❌ |
| `studio:content.manage_publications` | ✅ | ✅ | ✅ | ❌ |

---

## 4. Activity & Events

### Brand Event Tipleri

| Event Type | Tetiklendiği Aksiyon | Metadata |
|------------|---------------------|----------|
| `brand.created` | Brand oluşturulduğunda | `{ name, slug, readinessScore }` |
| `brand.updated` | Brand güncellendiğinde | `{ name, changes: { field: { before, after } } }` |
| `brand.deleted` | Brand arşivlendiğinde | `{ name, softDeleted: true }` |
| `brand.profile_completed` | Profil tamamlandığında | `{ name, previousScore, newScore }` |
| `brand.social_account_connected` | Sosyal hesap bağlandığında | `{ name, provider, handle }` |
| `brand.social_account_disconnected` | Sosyal hesap çıkarıldığında | `{ name, provider, handle }` |
| `brand.publishing_defaults_updated` | Yayın ayarları güncellendiğinde | `{ name }` |

### Content Event Tipleri (Future)

| Event Type | Tetiklendiği Aksiyon |
|------------|---------------------|
| `content.created` | Content oluşturulduğunda |
| `content.updated` | Content güncellendiğinde |
| `content.deleted` | Content silindiğinde |

### Publication Event Tipleri (Future)

| Event Type | Tetiklendiği Aksiyon |
|------------|---------------------|
| `publication.scheduled` | Yayın planlandığında |
| `publication.updated` | Yayın güncellendi |
| `publication.cancelled` | Yayın iptal edildi |
| `publication.published` | Yayın başarılı |
| `publication.failed` | Yayın başarısız |

### Activity Logging Pattern

```typescript
// Route handler'da, başarılı işlemden sonra:
void logActivity({
  type: "brand.created",
  workspaceId,
  userId,
  actorType: "user",
  source: "api",
  scopeType: "brand",
  scopeId: brand.id,
  metadata: {
    name: brand.name,
    slug: brand.slug,
    readinessScore: brand.readinessScore,
  },
  request,
});
```

---

## 5. API Endpoints

Base path: `/v1/brands`

### 5.1 List Brands

```
GET /v1/brands
```

**Permission:** `studio:brand.view`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max items per page (1-100) |
| `cursor` | string | - | Pagination cursor |
| `includeArchived` | boolean | false | Include archived brands |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cm...",
        "workspaceId": "cm...",
        "name": "My Brand",
        "slug": "my-brand",
        "description": "...",
        "industry": "Technology",
        "readinessScore": 40,
        "profileCompleted": true,
        "hasAtLeastOneSocialAccount": false,
        "publishingDefaultsConfigured": false,
        "isArchived": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "nextCursor": "cm..." | null
  }
}
```

**Activity Event:** Yok (read-only)

---

### 5.2 Create Brand

```
POST /v1/brands
```

**Permission:** `studio:brand.create`

**Validation Schema:** `createBrandSchema`

**Body:**
```json
{
  "name": "My Brand",
  "slug": "my-brand",  // Optional - auto-generated from name if not provided
  "description": "Optional description",
  "industry": "Technology",
  "language": "en",
  "timezone": "America/New_York",
  "toneOfVoice": "friendly",
  "primaryColor": "#3B82F6",
  "secondaryColor": "#10B981",
  "websiteUrl": "https://example.com"
}
```

**Slug Auto-Generation:**
- If `slug` is not provided, it will be generated from `name`
- Turkish characters are converted to ASCII equivalents (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u)
- Special characters are replaced with hyphens
- If the generated slug is already taken, a random 4-character suffix is appended
- Example: "Türkçe Marka" → "turkce-marka" or "turkce-marka-x7k9" (if taken)

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "name": "My Brand",
    "slug": "my-brand",
    "readinessScore": 0
  }
}
```

**Activity Event:** `brand.created`

---

### 5.3 Get Brand Details

```
GET /v1/brands/:brandId
```

**Permission:** `studio:brand.view`

**Validation Schema:** `brandParamsSchema`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "workspaceId": "cm...",
    "name": "My Brand",
    "slug": "my-brand",
    "description": "...",
    "industry": "Technology",
    "language": "en",
    "timezone": "America/New_York",
    "toneOfVoice": "friendly",
    "primaryColor": "#3B82F6",
    "secondaryColor": "#10B981",
    "websiteUrl": "https://example.com",
    "logoMediaId": null,
    "readinessScore": 40,
    "profileCompleted": true,
    "hasAtLeastOneSocialAccount": false,
    "publishingDefaultsConfigured": false,
    "isArchived": false,
    "isActive": true,
    "createdBy": "cm...",
    "updatedBy": "cm...",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Activity Event:** Yok (read-only)

---

### 5.4 Update Brand

```
PATCH /v1/brands/:brandId
```

**Permission:** `studio:brand.update`

**Validation Schema:** `updateBrandSchema`

**Body:** (partial, any fields)
```json
{
  "description": "Updated description",
  "language": "tr",
  "timezone": "Europe/Istanbul"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "name": "My Brand",
    "slug": "my-brand",
    "readinessScore": 40,
    "profileCompleted": true
  }
}
```

**Activity Events:**
- `brand.updated` (her güncellemede, değişen alanlar metadata'da)
- `brand.profile_completed` (profil ilk kez tamamlandığında)

---

### 5.5 Delete (Archive) Brand

```
DELETE /v1/brands/:brandId
```

**Permission:** `studio:brand.delete`

**Davranış:** Soft delete (isArchived = true)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Brand archived successfully",
    "brandId": "cm...",
    "isArchived": true
  }
}
```

**Activity Event:** `brand.deleted` (metadata: `{ softDeleted: true }`)

---

### 5.6 List Hashtag Presets

```
GET /v1/brands/:brandId/hashtag-presets
```

**Permission:** `studio:brand.update`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cm...",
        "brandId": "cm...",
        "name": "General Tags",
        "tags": ["#tech", "#startup", "#innovation"],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 5.7 Create Hashtag Preset

```
POST /v1/brands/:brandId/hashtag-presets
```

**Permission:** `studio:brand.update`

**Validation Schema:** `createBrandHashtagPresetSchema`

**Body:**
```json
{
  "name": "Campaign X Tags",
  "tags": ["#campaign", "#promo", "#sale"]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "brandId": "cm...",
    "name": "Campaign X Tags",
    "tags": ["#campaign", "#promo", "#sale"]
  }
}
```

**Activity Event:** `brand.updated` (hashtagPresetsCount changed)

---

### 5.8 Update Hashtag Preset

```
PATCH /v1/brands/:brandId/hashtag-presets/:presetId
```

**Permission:** `studio:brand.update`

**Validation Schema:** `updateBrandHashtagPresetSchema`

**Body:** (partial)
```json
{
  "name": "Updated Name",
  "tags": ["#new", "#tags"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "brandId": "cm...",
    "name": "Updated Name",
    "tags": ["#new", "#tags"]
  }
}
```

**Activity Event:** `brand.updated`

---

### 5.9 Delete Hashtag Preset

```
DELETE /v1/brands/:brandId/hashtag-presets/:presetId
```

**Permission:** `studio:brand.update`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Hashtag preset deleted successfully"
  }
}
```

**Activity Event:** `brand.updated` (hashtagPresetsCount changed)

---

## 6. Readiness & Wizard Flow

### ReadinessScore Hesaplama

```typescript
function calculateReadinessScore(brand: Brand): number {
  let score = 0;

  if (brand.profileCompleted) {
    score += 40;  // %40
  }

  if (brand.hasAtLeastOneSocialAccount) {
    score += 40;  // %40
  }

  if (brand.publishingDefaultsConfigured) {
    score += 20;  // %20
  }

  return score; // 0-100
}
```

### Profile Completion Kriterleri

Profil aşağıdaki alanlar doldurulduğunda "complete" sayılır:

- `name` (required for create)
- `description`
- `industry`
- `language`
- `timezone`

### Wizard Steps

1. **Profile Setup (40 pts)**
   - Brand adı, açıklama, sektör, dil ve timezone bilgileri
   - Tamamlandığında: `profileCompleted = true`, `brand.profile_completed` event

2. **Social Account Connection (40 pts)**
   - En az bir sosyal hesap bağlanması
   - Tamamlandığında: `hasAtLeastOneSocialAccount = true`, `brand.social_account_connected` event
   - (Bu sprint'te API yok, ileride eklenecek)

3. **Publishing Defaults (20 pts)**
   - Varsayılan yayın ayarlarının yapılması
   - Tamamlandığında: `publishingDefaultsConfigured = true`, `brand.publishing_defaults_updated` event
   - (Bu sprint'te API yok, ileride eklenecek)

---

## 7. Implementation Notes

### 7.1 Validation Standardı

Tüm input'lar Zod ile validate edilir:

```typescript
// Body validation
const input = validateBody(createBrandSchema, request);

// Params validation
const { brandId } = validateParams(brandParamsSchema, request.params);

// Query validation
const query = validateQuery(brandListQuerySchema, request.query);
```

Hata durumunda standart `VALIDATION_ERROR` formatı:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "path": ["slug"],
          "code": "invalid_string",
          "message": "validation.brand.slug.pattern"
        }
      ]
    }
  }
}
```

### 7.2 Tenant Guard & Multi-Tenant Pattern

Her workspace-scoped endpoint'te:

1. **Header validation:**
```typescript
const workspaceId = requireWorkspaceMatch(request);
```

2. **Permission check:**
```typescript
preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)]
```

3. **Entity-workspace validation:**
```typescript
const brand = await getBrand(brandId, workspaceId);
// getBrand içinde workspaceId kontrolü yapılır
```

### 7.3 Pagination

Cursor-based pagination kullanılır:

```typescript
const pagination = normalizeCursorPaginationInput({
  limit: query.limit,
  cursor: query.cursor,
});

const result = await brandService.listBrands({
  workspaceId,
  limit: pagination.limit,
  cursor: pagination.cursor,
});
```

Response format:
```json
{
  "items": [...],
  "nextCursor": "cm..." | null
}
```

### 7.4 Error Handling

HTTP errors `lib/http-errors.ts` kullanılır:

```typescript
throw new NotFoundError("BRAND_NOT_FOUND", { brandId });
throw new BadRequestError("SLUG_TAKEN", `Slug "${slug}" is already in use`);
throw new ForbiddenError("WORKSPACE_MISMATCH", { ... });
```

---

## 8. File Structure

```
apps/api/src/modules/brand/
├── brand.types.ts          # Domain type definitions
├── brand.repository.ts     # Prisma data access layer
├── brand.service.ts        # Business logic + activity logging
├── brand.routes.ts         # Fastify route handlers
├── brand.routes.spec.ts    # Integration tests
└── brand-domain.md         # Bu doküman
```

---

## 9. Frontend Integration

Bu section, Brand Studio frontend implementasyonunu açıklar.

### 9.1 Pages & Routes

| Route | Component | Açıklama |
|-------|-----------|----------|
| `/[locale]/[workspace]/studio/brands` | `BrandStudioPage` | Brand listesi |
| `/[locale]/[workspace]/studio/brands/[brandId]` | `BrandDetailPage` | Brand detay sayfası |

### 9.2 Main Components

```
apps/web/features/brand/
├── api/
│   └── brand-api.ts              # API client (httpClient wrapper)
├── types/
│   └── index.ts                  # Frontend type definitions
├── hooks/
│   ├── use-brands.ts             # Brand list hook
│   ├── use-brand.ts              # Single brand hook
│   ├── use-brand-mutations.ts    # Create/update/archive hooks
│   └── use-hashtag-presets.ts    # Hashtag preset hooks
├── components/
│   ├── brand-studio-page.tsx     # Main list page
│   ├── brand-detail-page.tsx     # Detail page with tabs
│   ├── brand-wizard.tsx          # Create/edit wizard (3-step)
│   ├── brand-readiness-panel.tsx # Readiness score display
│   ├── brand-list-table.tsx      # Brand table component
│   ├── brand-activity-panel.tsx  # Activity timeline
│   └── hashtag-presets-panel.tsx # Hashtag preset management
└── index.ts                      # Feature exports
```

### 9.3 Key Hooks

| Hook | Kullanım |
|------|----------|
| `useBrandList()` | Brand listesini getir (pagination destekli) |
| `useBrand(brandId)` | Tek brand detayını getir |
| `useCreateBrand()` | Yeni brand oluştur |
| `useUpdateBrand(brandId)` | Brand güncelle |
| `useArchiveBrand(brandId)` | Brand arşivle |
| `useHashtagPresets(brandId)` | Hashtag preset listesi |
| `useCreateHashtagPreset(brandId)` | Preset oluştur |
| `useUpdateHashtagPreset(brandId, presetId)` | Preset güncelle |
| `useDeleteHashtagPreset(brandId, presetId)` | Preset sil |

### 9.4 Permission Handling

UI'da permission kontrolü:

```tsx
// Page level
const canView = useHasPermission("studio:brand.view");
const canCreate = useHasPermission("studio:brand.create");
const canUpdate = useHasPermission("studio:brand.update");
const canDelete = useHasPermission("studio:brand.delete");

// Conditional rendering
{canCreate && <Button>New Brand</Button>}
{canUpdate && <Button>Edit</Button>}
{canDelete && <Button>Archive</Button>}
```

| Permission | UI Etkisi |
|------------|-----------|
| `studio:brand.view` | Brand Studio'ya erişim, sidebar'da görünürlük |
| `studio:brand.create` | "New Brand" butonu görünür |
| `studio:brand.update` | Edit, hashtag preset yönetimi |
| `studio:brand.delete` | Archive butonu görünür |

### 9.5 Wizard Steps

**Brand Wizard** 3 adımdan oluşur:

1. **Basic Info**
   - name (required)
   - slug (optional, auto-generated)
   - description, industry, language, timezone

2. **Identity**
   - websiteUrl
   - toneOfVoice
   - primaryColor, secondaryColor

3. **Hashtags**
   - Hashtag preset oluşturma/düzenleme
   - Preset listesi yönetimi

### 9.6 Activity Tab

Brand detail sayfasındaki Activity tab'ı:
- `/v1/activity?scopeType=brand&scopeId={brandId}` endpoint'ini kullanır
- Cursor-based pagination ile load more
- Event type'a göre human-readable title/summary gösterir

### 9.7 Sidebar Navigation

Brand Studio, workspace sidebar'da görünür:
- Icon: `Palette` (lucide-react)
- Route: `studio/brands`
- Permission: `studio:brand.view` olmayanlar göremez

---

## 10. Future Enhancements

- [ ] Social account management endpoints
- [ ] Publishing defaults configuration
- [ ] Brand logo upload (via media module)
- [ ] Brand analytics/metrics
- [ ] Content & Publication endpoints
- [ ] Real-time updates via WebSocket

---

## 11. Checklist: Yeni Brand Feature Eklerken

- [ ] Prisma model güncellemesi gerekiyor mu?
- [ ] Permission key eklenmesi gerekiyor mu?
- [ ] Activity event tipi eklenmesi gerekiyor mu?
- [ ] Validation schema eklenmesi gerekiyor mu?
- [ ] Repository fonksiyonu gerekiyor mu?
- [ ] Service fonksiyonu gerekiyor mu?
- [ ] Route handler'da activity logging var mı?
- [ ] Test coverage var mı?
- [ ] Bu doküman güncellendi mi?

---

**Son güncelleme:** Brand Domain v1 implementasyonu
**Versiyon:** 1.0

