# SocialAccount Domain v1

## Genel Bakış

SocialAccount domain'i, markaların sosyal medya hesaplarını yönetmek için kullanılan backend altyapısını sağlar. Bu domain:

- Birden fazla sosyal medya platformunu destekler
- Kimlik bilgilerini (credentials) şifreli olarak saklar
- Marka hazırlık durumu (readiness) ile entegredir
- Çoklu kiracı (multi-tenant) yapıyı destekler

### İlişkiler

```
Workspace (1) ─────┬───── (N) Brand
                   │
                   └───── (N) SocialAccount
                               │
Brand (1) ────────────── (N) SocialAccount
```

Her sosyal hesap hem bir workspace'e hem de bir markaya bağlıdır. Aynı sosyal hesap (platform + externalId) bir workspace içinde yalnızca bir kez eklenebilir.

> 📌 **Tasarım Kararı:** Aynı sosyal medya hesabı (örn: @mybusiness Instagram) bir workspace içinde yalnızca **tek bir markaya** bağlanabilir. Bu, işin doğasına uygundur - aynı Instagram hesabını 3 farklı markaya bağlamak pratikte mantıklı değildir.

---

## Veri Modeli

### Prisma Şeması

```prisma
enum SocialPlatform {
  FACEBOOK_PAGE
  INSTAGRAM_BUSINESS
  INSTAGRAM_BASIC
  YOUTUBE_CHANNEL
  TIKTOK_BUSINESS
  PINTEREST_PROFILE
  X_ACCOUNT
  LINKEDIN_PAGE
}

enum SocialAccountStatus {
  ACTIVE
  DISCONNECTED
  REMOVED
}

model SocialAccount {
  id          String              @id @default(cuid())
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  workspaceId String
  brandId     String
  platform    SocialPlatform
  externalId  String              // pageId / channelId / profileId / etc.
  username    String?
  displayName String?
  profileUrl  String?
  status      SocialAccountStatus @default(ACTIVE)
  lastSyncedAt DateTime?
  avatarMediaId String?

  credentialsEncrypted String     // Şifreli JSON blob
  platformData Json?              // Platform'a özgü meta veri

  workspace Workspace @relation(...)
  brand     Brand     @relation(...)

  @@unique([workspaceId, platform, externalId])
  @@index([workspaceId, brandId])
  @@index([platform, externalId])
}
```

### Alan Açıklamaları

| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | String | Benzersiz tanımlayıcı (CUID) |
| `platform` | Enum | Sosyal medya platformu |
| `externalId` | String | Platform'daki hesap ID'si (pageId, channelId vb.) |
| `username` | String? | Kullanıcı adı / handle (@username) |
| `displayName` | String? | Görünen isim |
| `profileUrl` | String? | Profil URL'si |
| `status` | Enum | Hesap durumu (ACTIVE, DISCONNECTED, REMOVED) |
| `lastSyncedAt` | DateTime? | Son senkronizasyon zamanı |
| `credentialsEncrypted` | String | **Şifreli** kimlik bilgileri (JSON) |
| `platformData` | Json? | Platform'a özgü meta veri (gizli olmayan) |

### credentialsEncrypted Alanı

Bu alan, tüm platform kimlik bilgilerini şifreli olarak saklar. **Asla** düz metin olarak saklanmaz.

**Şifreleme:**
- AES-256-GCM algoritması kullanılır
- Format: `iv:authTag:ciphertext` (tümü base64 kodlu)
- Anahtar: `SECRET_ENCRYPTION_KEY` veya `ACCESS_TOKEN_SECRET` env değişkeninden türetilir (SHA-256 ile 32 byte'a normalize edilir)

> ⚠️ **Geliştirme ortamı için anahtar üretimi:**
> ```bash
> openssl rand -hex 32
> ```
> Bu komutu çalıştırıp çıktıyı `.env` dosyasındaki `SECRET_ENCRYPTION_KEY` değişkenine atayın.

**İçerik yapısı:**
```typescript
type AnySocialCredentials =
  | { platform: "FACEBOOK_PAGE"; data: FacebookCredentials }
  | { platform: "INSTAGRAM_BUSINESS"; data: InstagramCredentials }
  // ... diğer platformlar
```

**Örnek (şifrelenmemiş JSON):**
```json
{
  "platform": "FACEBOOK_PAGE",
  "data": {
    "accessToken": "EAAxxxx...",
    "refreshToken": "abc123...",
    "expiresAt": "2024-12-31T23:59:59Z",
    "pageId": "123456789"
  }
}
```

### platformData Alanı

Platform'a özgü, gizli olmayan meta veriler için kullanılır. UI'da gösterilebilir.

**Örnek:**
```json
{
  "pageName": "My Business Page",
  "category": "Business",
  "avatarUrl": "https://...",
  "followersCount": 1234
}
```

---

## İzinler (Permissions)

### Yetki Tanımları

```typescript
const PERMISSIONS = {
  STUDIO_SOCIAL_ACCOUNT_VIEW: 'studio:social_account.view',
  STUDIO_SOCIAL_ACCOUNT_CONNECT: 'studio:social_account.connect',
  STUDIO_SOCIAL_ACCOUNT_DISCONNECT: 'studio:social_account.disconnect',
  STUDIO_SOCIAL_ACCOUNT_DELETE: 'studio:social_account.delete',
};
```

### Rol → İzin Matrisi

| İşlem | OWNER | ADMIN | EDITOR | VIEWER |
|-------|-------|-------|--------|--------|
| Görüntüle (view) | ✅ | ✅ | ✅ | ✅ |
| Bağla (connect) | ✅ | ✅ | ✅ | ❌ |
| Bağlantıyı kes (disconnect) | ✅ | ✅ | ✅ | ❌ |
| Sil (delete) | ✅ | ✅ | ❌ | ❌ |

---

## Activity Events

### Event Türleri

#### Sosyal Hesap Düzeyinde

| Event | Açıklama |
|-------|----------|
| `social_account.connected` | Yeni sosyal hesap bağlandı |
| `social_account.disconnected` | Sosyal hesap bağlantısı kesildi |
| `social_account.removed` | Sosyal hesap silindi |

#### Marka Düzeyinde

| Event | Açıklama |
|-------|----------|
| `brand.social_account_connected` | Markaya ilk sosyal hesap bağlandığında tetiklenir |
| `brand.social_account_disconnected` | Markadan sosyal hesap bağlantısı kesildiğinde |

### Örnek Event Metadata

**social_account.connected:**
```json
{
  "platform": "FACEBOOK_PAGE",
  "externalId": "123456789",
  "username": "mybusiness",
  "displayName": "My Business Page",
  "brandId": "clxyz...",
  "brandName": "My Brand"
}
```

**brand.social_account_connected:**
```json
{
  "name": "My Brand",
  "provider": "FACEBOOK_PAGE",
  "handle": "mybusiness",
  "isFirstAccount": true
}
```

---

## Marka Hazırlık Durumu (Brand Readiness)

SocialAccount değişiklikleri, markanın hazırlık durumunu otomatik olarak günceller.

> ✅ **Single Source of Truth:** Readiness hesaplaması `brandService.calculateReadinessScore()` fonksiyonu üzerinden yapılır. SocialAccount service bu helper'ı çağırır, lojiği kopyalamaz.

### Hesaplama Mantığı

```
readinessScore = 0

if (profileCompleted)           → +40 puan
if (hasAtLeastOneSocialAccount) → +40 puan
if (publishingDefaultsConfigured) → +20 puan

Toplam: 0-100 puan
```

### Tetikleyiciler

Aşağıdaki işlemler hazırlık durumunu yeniden hesaplar:

1. **Sosyal hesap bağlama (connect):**
   - `countActiveByBrand() > 0` ise `hasAtLeastOneSocialAccount = true`
   
2. **Bağlantıyı kesme (disconnect):**
   - Aktif hesap kalmadıysa `hasAtLeastOneSocialAccount = false`
   
3. **Silme (remove):**
   - Bağlantıyı kesme ile aynı mantık

---

## API Endpoint'leri

Tüm endpoint'ler `/v1/brands/:brandId/social-accounts` prefix'i altındadır.

### 1. Sosyal Hesapları Listele

```http
GET /v1/brands/:brandId/social-accounts
```

**İzin:** `studio:social_account.view`

**Query Parametreleri:**
| Parametre | Tür | Varsayılan | Açıklama |
|-----------|-----|------------|----------|
| `limit` | number | 50 | Sayfa başına kayıt (max: 100) |
| `cursor` | string | - | Sayfalama cursor'ı |
| `status` | enum | ACTIVE | Durum filtresi |

**Örnek Yanıt:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxyz123...",
        "workspaceId": "clws123...",
        "brandId": "clbr123...",
        "platform": "FACEBOOK_PAGE",
        "externalId": "123456789",
        "username": "mybusiness",
        "displayName": "My Business Page",
        "profileUrl": "https://facebook.com/mybusiness",
        "status": "ACTIVE",
        "lastSyncedAt": null,
        "avatarMediaId": null,
        "platformData": { "pageName": "My Business" },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

> ⚠️ **Not:** `credentialsEncrypted` alanı **asla** API yanıtında döndürülmez.

### 2. Sosyal Hesap Bağla

```http
POST /v1/brands/:brandId/social-accounts
```

**İzin:** `studio:social_account.connect`

**Request Body:**
```json
{
  "platform": "FACEBOOK_PAGE",
  "externalId": "123456789",
  "username": "mybusiness",
  "displayName": "My Business Page",
  "profileUrl": "https://facebook.com/mybusiness",
  "platformData": {
    "pageName": "My Business",
    "category": "Business"
  },
  "credentials": {
    "platform": "FACEBOOK_PAGE",
    "data": {
      "accessToken": "EAAxxxx...",
      "refreshToken": "abc123...",
      "expiresAt": "2024-12-31T23:59:59Z"
    }
  }
}
```

**Yanıt (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123...",
    "workspaceId": "clws123...",
    "brandId": "clbr123...",
    "platform": "FACEBOOK_PAGE",
    "externalId": "123456789",
    "username": "mybusiness",
    "displayName": "My Business Page",
    "profileUrl": "https://facebook.com/mybusiness",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Hata Durumları:**
- `409 Conflict`: Aynı platform + externalId zaten workspace'te mevcut

### 3. Sosyal Hesap Bağlantısını Kes

```http
POST /v1/brands/:brandId/social-accounts/:socialAccountId/disconnect
```

**İzin:** `studio:social_account.disconnect`

**Davranış:**
- Status → `DISCONNECTED`
- `credentialsEncrypted` → boş string (siliniyor)
- Activity log kaydı oluşturulur
- Marka hazırlık durumu güncellenir

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123...",
    "status": "DISCONNECTED",
    "message": "Social account disconnected successfully"
  }
}
```

### 4. Sosyal Hesabı Sil

```http
DELETE /v1/brands/:brandId/social-accounts/:socialAccountId
```

**İzin:** `studio:social_account.delete`

**Davranış:**
- Status → `REMOVED`
- `credentialsEncrypted` → boş string (siliniyor)
- Soft delete (kayıt veritabanında kalır)
- Activity log kaydı oluşturulur
- Marka hazırlık durumu güncellenir

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123...",
    "status": "REMOVED",
    "message": "Social account removed successfully"
  }
}
```

---

## Güvenlik Notları

1. **Kimlik Bilgileri Şifrelemesi:**
   - Tüm OAuth token'ları AES-256-GCM ile şifrelenir
   - Şifreleme anahtarı ortam değişkeninden alınır
   - Veritabanında düz metin token **asla** saklanmaz
   - ⚠️ `decryptSocialCredentials` kullanıldığında çıktı **asla log'lara yazılmamalı**

2. **Bağlantı Kesme/Silme:**
   - Her iki işlemde de `credentialsEncrypted` boş string (`""`) olarak set edilir
   - Token'lar kurtarılamaz hale gelir
   - Test suite'de bu davranış `prisma.socialAccount.findUnique` ile doğrulanır

3. **API Yanıtları:**
   - `credentialsEncrypted` alanı hiçbir endpoint'te döndürülmez
   - Yalnızca `platformData` (gizli olmayan meta veri) UI'a iletilir

4. **Tenant İzolasyonu:**
   - Tüm sorgular `workspaceId` ile filtrelenir
   - Cross-tenant erişim engellenir

---

## Gelecek Çalışmalar

### Sprint Kapsamı Dışı (OUT OF SCOPE)

Bu sprint'te aşağıdakiler **uygulanmadı:**

1. **Gerçek OAuth Akışları:**
   - Facebook/Instagram OAuth
   - X (Twitter) OAuth
   - LinkedIn OAuth
   - YouTube OAuth
   - TikTok OAuth
   - Pinterest OAuth

2. **Harici Provider API Çağrıları:**
   - Token yenileme (refresh)
   - Profil senkronizasyonu
   - İçerik yayınlama

3. **Frontend UI:**
   - Sosyal hesap bağlama modal'ı
   - OAuth callback sayfaları

### Planlanan İyileştirmeler

- [ ] Provider-specific OAuth connector'lar
- [ ] Avatar mirror'lama (Media service'e)
- [ ] Otomatik token yenileme
- [ ] Webhook entegrasyonu
- [ ] Rate limiting ve kota yönetimi

---

## Dosya Yapısı

```
apps/api/src/modules/social-account/
├── social-account.types.ts       # Tip tanımları ve şifreleme helpers
├── social-account.repository.ts  # Prisma data access layer
├── social-account.service.ts     # İş mantığı katmanı
├── social-account.routes.ts      # Fastify route'ları
├── social-account.routes.spec.ts # Test dosyası
└── social-account-domain.md      # Bu dokümantasyon
```

---

## Test Çalıştırma

```bash
cd apps/api
pnpm exec tsx src/modules/social-account/social-account.routes.spec.ts
```

Test senaryoları:
- ✅ Sosyal hesap bağlama (connect)
- ✅ Kimlik bilgilerinin şifreli saklandığının doğrulanması
- ✅ Marka hazırlık durumu güncellemesi
- ✅ Listeleme ve sayfalama
- ✅ Duplikasyon önleme
- ✅ Cross-tenant erişim engeli
- ✅ İzin kontrolleri
- ✅ Bağlantı kesme (disconnect)
- ✅ Silme (remove)
- ✅ Activity event'lerin oluşturulması

---

## Frontend Entegrasyonu

### Brand Studio – Social Accounts Tab

Brand detay sayfasına eklenen "Social Accounts" tab'ı, bu domain'in frontend karşılığıdır.

#### Dosya Yapısı

```
apps/web/features/social-account/
├── api/
│   ├── social-account-api.ts    # HTTP client wrapper
│   └── index.ts
├── hooks/
│   ├── use-social-accounts.ts   # Liste data fetching
│   ├── use-social-account-mutations.ts  # Connect/disconnect/delete
│   └── index.ts
├── types/
│   └── index.ts                 # SocialAccount, SocialPlatform, vb.
└── index.ts                     # Barrel export

apps/web/features/brand/components/
├── brand-social-accounts-panel.tsx       # Ana panel komponenti
├── brand-social-account-connect-dialog.tsx  # Bağlama dialog'u
└── social-platform-icon.tsx              # Platform icon'ları
```

#### Kullanılan Endpoint'ler

| Endpoint | Yöntem | İzin |
|----------|--------|------|
| `/v1/brands/:brandId/social-accounts` | GET | `studio:social_account.view` |
| `/v1/brands/:brandId/social-accounts` | POST | `studio:social_account.connect` |
| `/v1/brands/:brandId/social-accounts/:id/disconnect` | POST | `studio:social_account.disconnect` |
| `/v1/brands/:brandId/social-accounts/:id` | DELETE | `studio:social_account.delete` |

#### Permission Kontrolleri

```tsx
// Tab görünürlüğü
const canViewSocialAccounts = useHasPermission("studio:social_account.view");

// Buton görünürlükleri
const canConnect = useHasPermission("studio:social_account.connect");
const canDisconnect = useHasPermission("studio:social_account.disconnect");
const canDelete = useHasPermission("studio:social_account.delete");
```

#### Readiness & Activity Entegrasyonu

**Readiness Panel Güncellemesi:**
- Her mutation (connect/disconnect/delete) sonrasında `onBrandRefresh` callback'i tetiklenir
- Brand detail query'si yeniden fetch edilir
- Readiness panel otomatik olarak güncellenir

**Activity Panel:**
- Backend'de oluşturulan activity event'leri:
  - `social_account.connected`
  - `social_account.disconnected`
  - `social_account.removed`
  - `brand.social_account_connected`
- Activity panel mevcut workspace activity endpoint'ini kullandığı için ek işlem gerekmez

#### UI Özellikleri

1. **Liste Görünümü:**
   - Platform icon'u ve adı
   - Display name ve username
   - Status badge (ACTIVE, DISCONNECTED, REMOVED)
   - Last synced timestamp (relative time)
   - Action butonları (disconnect, delete)

2. **Empty State:**
   - Hesap yokken bilgilendirici mesaj
   - Connect butonu (izin varsa)

3. **Connect Dialog:**
   - Platform seçimi
   - Display name, username, external ID
   - Profile URL (opsiyonel)
   - Dev credentials JSON (test için)

4. **Confirmation Dialog'ları:**
   - Disconnect: Kimlik bilgilerinin silineceği uyarısı
   - Delete: Geri alınamaz uyarısı

