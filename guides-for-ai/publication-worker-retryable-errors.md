# Publication Worker Retryable Errors Rehberi

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [RetryablePublicationError Nedir?](#retryablepublicationerror-nedir)
3. [Neden Kullanıyoruz?](#neden-kullanıyoruz)
4. [Sistem Mimarisi](#sistem-mimarisi)
5. [Hangi Hatalar Retryable?](#hangi-hatalar-retryable)
6. [Kullanım Rehberi](#kullanım-rehberi)
7. [Yeni Platform Ekleme Checklist](#yeni-platform-ekleme-checklist)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Genel Bakış

Bu rehber, yeni platform publication worker'ları geliştirirken **RetryablePublicationError** sistemini doğru şekilde kullanmak için hazırlanmıştır. Bu sistem, geçici hataların (transient errors) kalıcı hatalardan (permanent errors) ayrılmasını sağlar ve Sentry'ye gereksiz error gönderilmesini önler.

---

## RetryablePublicationError Nedir?

`RetryablePublicationError`, geçici hatalar için özel olarak tasarlanmış bir error class'ıdır. Bu hatalar:

- **Geçicidir**: Kısa süre içinde düzelebilir (örn: medya işleniyor, rate limit)
- **Retry edilebilir**: BullMQ tarafından otomatik olarak yeniden denenebilir
- **Sentry'ye gönderilmez**: Max attempts'a ulaşana kadar Sentry'ye gönderilmez

```typescript
export class RetryablePublicationError extends Error {
  readonly isRetryable = true;
  
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "RetryablePublicationError";
  }
}
```

---

## Neden Kullanıyoruz?

### Problem

Publication worker'larında, bazen geçici hatalar oluşur:
- Instagram: "Medya yayınlanmaya hazır değil. Lütfen biraz bekle"
- Facebook: Rate limiting hatası
- Genel: API'nin işleme süresi (media processing)

Bu hatalar:
1. ✅ **Normaldir**: Medya işlenirken beklenen durumlar
2. ✅ **Geçicidir**: Birkaç saniye/dakika sonra düzelir
3. ❌ **Sentry'yi doldurur**: Her retry'da Sentry'ye gönderilir
4. ❌ **Gürültü oluşturur**: Gerçek problemleri maskeleyebilir

### Çözüm

RetryablePublicationError ile:
- ✅ Geçici hatalar Sentry'ye gönderilmez
- ✅ Sadece max attempts sonrası Sentry'ye gönderilir
- ✅ Log seviyesi düşürülür (error → warn)
- ✅ Gerçek problemler daha görünür olur

---

## Sistem Mimarisi

### 1. Error Detection (`isRetryableError`)

```typescript
// apps/api/src/core/queue/workers/graph-api.utils.ts

export function isRetryableError(error: GraphApiResponse["error"] | undefined): boolean {
  if (!error) return false;
  
  // Retryable error codes (rate limiting, temporary failures)
  const retryableCodes = [4, 17, 32, 613, 80001];
  
  if (retryableCodes.includes(error.code)) {
    return true;
  }
  
  // Check error message for retryable patterns
  const errorMessage = (error.error_user_msg || error.message || "").toLowerCase();
  
  const retryablePatterns = [
    "medya yayınlanmaya hazır değil",
    "not ready",
    "media is not ready",
    "please wait",
    "processing",
    "in progress",
    "hazır değil",
  ];
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}
```

### 2. Error Class

```typescript
// apps/api/src/core/queue/workers/graph-api.utils.ts

export class RetryablePublicationError extends Error {
  readonly isRetryable = true;
  
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "RetryablePublicationError";
  }
}
```

### 3. BullMQ Worker Integration

```typescript
// apps/api/src/core/queue/bullmq.ts

worker.on("failed", (job, err) => {
  const isRetryable = (err as any).isRetryable === true;
  const attemptsMade = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts?.attempts ?? 3;
  const isMaxAttemptsReached = attemptsMade >= maxAttempts;
  
  // Retryable error with attempts remaining
  if (isRetryable && !isMaxAttemptsReached) {
    logger.warn(/* ... */, "Job failed (retryable, will retry)");
    return; // Don't send to Sentry
  }
  
  // Non-retryable or max attempts reached
  logger.error(/* ... */, "Job failed");
  if (isSentryInitialized()) {
    captureException(err, {/* ... */});
  }
});
```

---

## Hangi Hatalar Retryable?

### ✅ Retryable Hatalar (Geçici)

1. **Rate Limiting**
   - Error codes: 4, 17, 32, 613, 80001
   - Örnek: "Application request limit reached"

2. **Media Not Ready**
   - Error messages: "medya yayınlanmaya hazır değil", "not ready", "processing"
   - Örnek: Instagram media henüz işleniyor

3. **Processing Errors**
   - Error messages: "in progress", "please wait"
   - Örnek: Video encoding devam ediyor

4. **Temporary API Issues**
   - Network timeouts
   - Temporary service unavailability (503, 502)

### ❌ Non-Retryable Hatalar (Kalıcı)

1. **Authentication Errors**
   - Error code: 190 (Invalid OAuth access token)
   - Örnek: Access token geçersiz

2. **Permission Errors**
   - Error code: 200 (Permissions error)
   - Örnek: Gerekli izinler yok

3. **Validation Errors**
   - Error code: 100 (Invalid parameter)
   - Örnek: Geçersiz media URL

4. **Object Not Found**
   - Error code: 100 (Object doesn't exist)
   - Örnek: Media silinmiş

---

## Kullanım Rehberi

### 1. Import Gerekli Modülleri

```typescript
import {
  graphPost,
  graphGet,
  extractGraphApiErrorMessage,
  isRetryableError,
  RetryablePublicationError,
} from "./graph-api.utils.js";
```

### 2. API Call Yapıldıktan Sonra Error Handling

```typescript
// ❌ YANLIŞ: Direkt throw
const response = await graphPost(/* ... */);
if (response.error || !response.id) {
  throw new Error(`Failed to publish: ${response.error?.message}`);
}

// ✅ DOĞRU: Retryable kontrolü yap
const response = await graphPost(/* ... */);
if (response.error || !response.id) {
  const errorMessage = extractGraphApiErrorMessage(response.error);
  const fullMessage = `Failed to publish: ${errorMessage}`;
  
  // Check if this is a retryable error
  if (isRetryableError(response.error)) {
    throw new RetryablePublicationError(fullMessage, response.error);
  }
  
  throw new Error(fullMessage);
}
```

### 3. Tüm API Call'larını Kapsa

Retryable error handling'i **tüm API call'larında** kullan:

- ✅ Container creation
- ✅ Media publish
- ✅ Post creation
- ✅ Upload operations
- ✅ Status checks

### 4. Örnek: Tam Worker Implementation

```typescript
async function publishToPlatform(
  platformId: string,
  payload: PublicationPayload,
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // 1. Create container
  const containerResponse = await graphPost(
    `/${platformId}/media`,
    containerParams,
    accessToken
  );

  if (containerResponse.error || !containerResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(containerResponse.error);
    const fullMessage = `Failed to create container: ${errorMessage}`;
    
    if (isRetryableError(containerResponse.error)) {
      throw new RetryablePublicationError(fullMessage, containerResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const containerId = containerResponse.id;

  // 2. Publish container
  const publishResponse = await graphPost(
    `/${platformId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(publishResponse.error);
    const fullMessage = `Failed to publish: ${errorMessage}`;
    
    if (isRetryableError(publishResponse.error)) {
      throw new RetryablePublicationError(fullMessage, publishResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  return {
    postId: publishResponse.id,
    permalink: "",
  };
}
```

---

## Yeni Platform Ekleme Checklist

Yeni bir platform publication worker'ı eklerken aşağıdaki adımları takip et:

### ✅ 1. Import'ları Ekle

```typescript
import {
  // ... diğer utilities
  isRetryableError,
  RetryablePublicationError,
} from "./graph-api.utils.js";
```

### ✅ 2. API Error Handling Pattern'ini Uygula

Her API call'dan sonra:

```typescript
if (response.error || !response.successField) {
  const errorMessage = extractGraphApiErrorMessage(response.error);
  const fullMessage = `Failed to <operation>: ${errorMessage}`;
  
  if (isRetryableError(response.error)) {
    throw new RetryablePublicationError(fullMessage, response.error);
  }
  
  throw new Error(fullMessage);
}
```

### ✅ 3. Platform-Specific Retryable Patterns Ekle

Eğer platform'un kendine özel retryable error pattern'leri varsa, `isRetryableError` fonksiyonunu genişlet:

```typescript
// graph-api.utils.ts içinde

export function isRetryableError(error: GraphApiResponse["error"] | undefined): boolean {
  // ... mevcut kontroller
  
  // Yeni platform için özel pattern'ler
  const platformSpecificPatterns = [
    "your-platform-specific-error",
    "another-pattern",
  ];
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}
```

### ✅ 4. Test Et

- ✅ Retryable error durumunda Sentry'ye gönderilmediğini doğrula
- ✅ Max attempts sonrası Sentry'ye gönderildiğini doğrula
- ✅ Log seviyesinin doğru olduğunu kontrol et (warn vs error)

### ✅ 5. Dokümantasyonu Güncelle

Platform'a özel retryable error pattern'leri varsa, bu rehbere ekle.

---

## Best Practices

### 1. **Tutarlılık**

Tüm API call'larında aynı pattern'i kullan:

```typescript
// Her zaman aynı yapıyı kullan
if (response.error || !response.id) {
  const errorMessage = extractGraphApiErrorMessage(response.error);
  const fullMessage = `Failed to <operation>: ${errorMessage}`;
  
  if (isRetryableError(response.error)) {
    throw new RetryablePublicationError(fullMessage, response.error);
  }
  
  throw new Error(fullMessage);
}
```

### 2. **Descriptive Error Messages**

Error message'lar açıklayıcı olsun:

```typescript
// ❌ Kötü
throw new Error(errorMessage);

// ✅ İyi
throw new Error(`Failed to publish ${contentType} to ${platform}: ${errorMessage}`);
```

### 3. **Original Error'ı Sakla**

Original error'ı RetryablePublicationError'a geçir:

```typescript
throw new RetryablePublicationError(fullMessage, response.error);
```

Bu, debugging için yararlıdır.

### 4. **Logging**

Retryable hatalar için detaylı log ekle:

```typescript
if (isRetryableError(response.error)) {
  logger.warn(
    {
      platformId,
      contentType,
      error: response.error,
    },
    "Retryable error encountered, will retry"
  );
  throw new RetryablePublicationError(fullMessage, response.error);
}
```

### 5. **Platform-Specific Error Codes**

Platform'un error code'larını dokümante et:

```typescript
// Yorum olarak ekle
// Platform X retryable error codes:
// - 1001: Media processing
// - 1002: Rate limit exceeded
// - 1003: Temporary service unavailability
```

---

## Troubleshooting

### Problem: Retryable hatalar Sentry'ye gönderiliyor

**Çözüm:**
1. `RetryablePublicationError` class'ının `isRetryable = true` property'sine sahip olduğunu kontrol et
2. Error'ı `RetryablePublicationError` olarak throw ettiğinden emin ol
3. BullMQ worker'ın `isRetryable` kontrolünü yaptığını doğrula

### Problem: Tüm hatalar retryable olarak işaretleniyor

**Çözüm:**
1. `isRetryableError` fonksiyonunun doğru çalıştığını kontrol et
2. Platform'un error code'larını dokümante et
3. Gerekirse platform-specific kontrol ekle

### Problem: Max attempts sonrası Sentry'ye gönderilmiyor

**Çözüm:**
1. BullMQ worker'ın max attempts kontrolünü yaptığından emin ol
2. Job'ın `attempts` option'ının doğru set edildiğini kontrol et

---

## Örnekler

### Örnek 1: Instagram Worker

```typescript
// publication-instagram.worker.ts

async function publishInstagramImage(
  igUserId: string,
  payload: InstagramPublicationPayload,
  accessToken: string
): Promise<{ containerId: string; mediaId: string; permalink: string }> {
  // 1. Create container
  const containerResponse = await graphPost(/* ... */);
  
  if (containerResponse.error || !containerResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(containerResponse.error);
    const fullMessage = `Failed to create IG media container: ${errorMessage}`;
    
    if (isRetryableError(containerResponse.error)) {
      throw new RetryablePublicationError(fullMessage, containerResponse.error);
    }
    
    throw new Error(fullMessage);
  }
  
  // 2. Publish container
  const publishResponse = await graphPost(/* ... */);
  
  if (publishResponse.error || !publishResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(publishResponse.error);
    const fullMessage = `Failed to publish IG media: ${errorMessage}`;
    
    if (isRetryableError(publishResponse.error)) {
      throw new RetryablePublicationError(fullMessage, publishResponse.error);
    }
    
    throw new Error(fullMessage);
  }
  
  // ... rest of the function
}
```

### Örnek 2: Facebook Worker

```typescript
// publication-facebook.worker.ts

async function publishFacebookPhoto(
  pageId: string,
  payload: FacebookPublicationPayload,
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  const postResponse = await graphPost(
    `/${pageId}/photos`,
    postParams,
    accessToken
  );
  
  if (postResponse.error || !postResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(postResponse.error);
    const fullMessage = `Failed to post FB photo: ${errorMessage}`;
    
    if (isRetryableError(postResponse.error)) {
      throw new RetryablePublicationError(fullMessage, postResponse.error);
    }
    
    throw new Error(fullMessage);
  }
  
  // ... rest of the function
}
```

---

## Kaynak Dosyalar

- **Error Class & Utilities**: `apps/api/src/core/queue/workers/graph-api.utils.ts`
- **BullMQ Integration**: `apps/api/src/core/queue/bullmq.ts`
- **Instagram Worker**: `apps/api/src/core/queue/workers/publication-instagram.worker.ts`
- **Facebook Worker**: `apps/api/src/core/queue/workers/publication-facebook.worker.ts`

---

## Sonuç

RetryablePublicationError sistemi, publication worker'larında geçici hataları kalıcı hatalardan ayırarak:

- ✅ Sentry'yi gereksiz error'larla doldurmaz
- ✅ Gerçek problemleri daha görünür yapar
- ✅ Otomatik retry mekanizmasını destekler
- ✅ Daha iyi monitoring ve debugging sağlar

Yeni platform eklerken bu rehberi takip ederek sistemle tam entegre çalışan bir worker geliştirebilirsiniz.

