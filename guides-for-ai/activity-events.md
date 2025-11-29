# Activity Events & Audit Log Sistemi

Bu dokümantasyon, BRINT projesinde Activity Events ve Audit Log sistemini nasıl kullanacağınızı, yeni event'leri nasıl entegre edeceğinizi ve best practice'leri açıklar.

> **📌 İlk Kurulum**: Migration'ı uygulamak için:
> ```bash
> cd apps/api
> npx prisma migrate dev
> ```
> Bu komut `activity_events` tablosunu oluşturacaktır.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Mimari](#mimari)
3. [Temel Kullanım](#temel-kullanım)
4. [Entegrasyon Senaryoları](#entegrasyon-senaryoları)
5. [Yeni Event Tipi Ekleme](#yeni-event-tipi-ekleme)
6. [Best Practices](#best-practices)
7. [Örnekler](#örnekler)
8. [Activity Events Okuma/Sorgulama](#activity-events-okumasorgulama)

---

## Genel Bakış

Activity Events sistemi, BRINT uygulamasındaki tüm önemli aksiyonları (user-initiated ve system events) tek bir global event store'da loglar. Bu sistem şunlar için kullanılır:

- **Audit Log**: "Kim ne yaptı?" - Compliance ve güvenlik
- **Activity Feed**: Kullanıcı aktivite timeline'ı
- **AI Event Log**: AI için context sağlamak ("son 7 günde workspace'te neler oldu?")
- **Debugging**: Request tracing ve problem analizi

### Özellikler

- ✅ Tek tablo (`activity_events`) ile tüm event'leri loglama
- ✅ User, System, ve Integration event'leri destekler
- ✅ Type-safe TypeScript API
- ✅ Fire-and-forget (ana akışı bloklamaz)
- ✅ Request ID ile trace edilebilir
- ✅ Metadata ile esnek detay ekleme

---

## Mimari

### Database Model

```
activity_events
├── id (cuid)
├── createdAt (timestamp)
├── workspaceId (FK → workspaces, nullable)
├── userId (FK → users, nullable)
├── actorType ('user' | 'system' | 'integration')
├── source ('api' | 'worker' | 'webhook' | 'automation')
├── type (string) - Event tipi, örn: 'auth.magic_link_requested'
├── scopeType ('workspace' | 'brand' | 'content' | 'user' | ...)
├── scopeId (string, nullable) - İlgili entity ID'si
├── requestId (string, nullable) - X-Request-Id trace için
└── metadata (JSONB) - Event'e özel detaylar
```

### Indexler

- `[workspaceId, createdAt]` - Timeline sorguları için
- `[type]` - Event type sorguları için
- `[scopeType, scopeId]` - Scope bazlı sorgular için

### Service Yapısı

```
apps/api/src/modules/activity/
└── activity.service.ts    # logActivity() fonksiyonu
```

---

## Temel Kullanım

### logActivity() Fonksiyonu

Activity event loglamak için `logActivity()` fonksiyonunu kullanın:

```typescript
import { logActivity } from "@/modules/activity/activity.service.js";

await logActivity({
  type: "workspace.member_invited",
  workspaceId: "workspace-id",
  userId: "user-id",
  actorType: "user",
  source: "api",
  scopeType: "workspace",
  scopeId: "workspace-id",
  metadata: {
    inviteId: "invite-id",
    invitedEmail: "user@example.com",
  },
  request, // Optional: requestId ve userId otomatik çıkarılır
});
```

### Parametreler

| Parametre | Tip | Açıklama | Zorunlu |
|-----------|-----|----------|---------|
| `type` | `ActivityEventType` | Event tipi (enum) | ✅ |
| `workspaceId` | `string \| null` | Workspace ID | ❌ |
| `userId` | `string \| null` | User ID (request'ten otomatik çıkarılabilir) | ❌ |
| `actorType` | `'user' \| 'system' \| 'integration'` | Aktör tipi (default: `'user'`) | ❌ |
| `source` | `'api' \| 'worker' \| 'webhook' \| 'automation'` | Kaynak (default: `'api'`) | ❌ |
| `scopeType` | `ActivityScopeType` | Scope tipi | ❌ |
| `scopeId` | `string \| null` | Scope entity ID'si | ❌ |
| `metadata` | `Record<string, unknown>` | Event detayları (JSONB) | ❌ |
| `requestId` | `string \| null` | Request ID (request'ten otomatik çıkarılabilir) | ❌ |
| `request` | `FastifyRequest` | Request objesi (otomatik extraction için) | ❌ |

### Önemli Notlar

1. **Fire-and-forget**: `logActivity()` async ama hata fırlatmaz. Ana akışı bloklamaz.
2. **Otomatik Extraction**: `request` parametresi verilirse:
   - `requestId` → `X-Request-Id` header'ından veya `request.requestId`'den
   - `userId` → `request.auth?.userId`'den otomatik çıkarılır
3. **Void kullanımı**: Async fonksiyon ama await etmeden de kullanılabilir:
   ```typescript
   void logActivity({ ... }); // Fire-and-forget
   ```

---

## Entegrasyon Senaryoları

### 1. API Handler'da User-Initiated Event

**Senaryo**: Kullanıcı bir action yaptığında (ör: content oluşturma, invite gönderme)

**Konum**: Route handler'ın içinde, ana işlem başarılı olduktan sonra

**Pattern**:

```typescript
// apps/api/src/modules/content/content.routes.ts
import { logActivity } from "../activity/activity.service.js";

app.post("/workspaces/:workspaceId/contents", {
  preHandler: [requirePermission(PERMISSIONS.CONTENT_CREATE)],
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const { workspaceId } = request.params;
  const userId = request.auth?.userId;

  // Ana işlem: Content oluştur
  const content = await contentService.create({
    workspaceId,
    title: request.body.title,
    createdBy: userId,
  });

  // ✅ Activity event logla (başarılı işlemden sonra)
  void logActivity({
    type: "content.created",
    workspaceId,
    userId, // request.auth'dan otomatik çıkarılır
    actorType: "user",
    source: "api",
    scopeType: "content",
    scopeId: content.id,
    metadata: {
      contentId: content.id,
      title: content.title,
      brandId: content.brandId,
    },
    request, // requestId ve userId otomatik çıkarılır
  });

  return reply.send({ success: true, data: content });
});
```

### 2. Worker'da System Event

**Senaryo**: Background job tamamlandığında (ör: snapshot generation, publication)

**Konum**: Worker processor function'ının içinde, işlem başarılı olduktan sonra

**Pattern**:

```typescript
// apps/api/src/core/queue/snapshot.queue.ts
import { logActivity } from "@/modules/activity/activity.service.js";

async function processSnapshotJob(job: Job<SnapshotJobData>): Promise<void> {
  const { workspaceId, brandId, period } = job.data;

  try {
    // Ana işlem: Snapshot oluştur
    const snapshot = await snapshotService.generate({
      workspaceId,
      brandId,
      period,
    });

    // ✅ Activity event logla (system event)
    await logActivity({
      type: "snapshot.generated",
      workspaceId,
      userId: null, // System event, user yok
      actorType: "system",
      source: "worker",
      scopeType: "brand",
      scopeId: brandId,
      metadata: {
        snapshotId: snapshot.id,
        period: period,
        recordCount: snapshot.recordCount,
      },
      // Worker'larda request yok, requestId manuel veya null
      requestId: null,
    });

    logger.info({ snapshotId: snapshot.id }, "Snapshot generated successfully");
  } catch (error) {
    // Hata durumunda da loglayabilirsiniz
    await logActivity({
      type: "snapshot.failed",
      workspaceId,
      actorType: "system",
      source: "worker",
      scopeType: "brand",
      scopeId: brandId,
      metadata: {
        error: error.message,
        period,
      },
    });
    throw error;
  }
}
```

### 3. Webhook Handler'da Integration Event

**Senaryo**: External service'den webhook geldiğinde

**Pattern**:

```typescript
// apps/api/src/modules/integrations/webhook.routes.ts
import { logActivity } from "../activity/activity.service.js";

app.post("/webhooks/stripe", async (request: FastifyRequest, reply: FastifyReply) => {
  const event = request.body; // Stripe webhook event

  // Webhook'u işle
  await stripeService.handleWebhook(event);

  // ✅ Activity event logla (integration event)
  void logActivity({
    type: "billing.webhook_received",
    workspaceId: event.metadata?.workspaceId ?? null,
    userId: null,
    actorType: "integration",
    source: "webhook",
    scopeType: "billing",
    scopeId: event.customer,
    metadata: {
      eventType: event.type,
      stripeEventId: event.id,
      amount: event.data?.object?.amount,
    },
    requestId: request.headers["x-request-id"] as string | undefined,
  });

  return reply.send({ received: true });
});
```

### 4. Automation/Background Task

**Senaryo**: Scheduled task, cron job, veya otomatik işlem

**Pattern**:

```typescript
// apps/api/src/core/automation/subscription-renewal.ts
import { logActivity } from "@/modules/activity/activity.service.js";

export async function renewExpiredSubscriptions(): Promise<void> {
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      periodEnd: { lte: new Date() },
    },
  });

  for (const subscription of expiredSubscriptions) {
    try {
      // Subscription'ı yenile
      await subscriptionService.renew(subscription.id);

      // ✅ Activity event logla
      await logActivity({
        type: "workspace.subscription_renewed",
        workspaceId: subscription.workspaceId,
        userId: null,
        actorType: "system",
        source: "automation",
        scopeType: "billing",
        scopeId: subscription.id,
        metadata: {
          plan: subscription.plan,
          previousPeriodEnd: subscription.periodEnd,
          newPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      // Renewal başarısız olursa
      await logActivity({
        type: "workspace.subscription_renewal_failed",
        workspaceId: subscription.workspaceId,
        actorType: "system",
        source: "automation",
        scopeType: "billing",
        scopeId: subscription.id,
        metadata: {
          error: error.message,
        },
      });
    }
  }
}
```

---

## Yeni Event Tipi Ekleme

Yeni bir event tipi eklemek için 2 adım:

### 1. Event Tipini Enum'a Ekle

`apps/api/src/modules/activity/activity.service.ts` dosyasında:

```typescript
export type ActivityEventType =
  | "auth.magic_link_requested"
  | "auth.magic_link_login_success"
  | "workspace.member_invited"
  | "content.created"           // ✅ Yeni event tipi
  | "content.updated"
  | "content.deleted"
  | "snapshot.generated"        // ✅ System event
  | "publication.completed";
```

### 2. İlgili Handler'da Loglama Ekleyin

```typescript
// Content oluşturma handler'ında
void logActivity({
  type: "content.created", // ✅ Enum'da tanımlı
  workspaceId,
  userId,
  scopeType: "content",
  scopeId: content.id,
  metadata: {
    contentId: content.id,
    title: content.title,
  },
  request,
});
```

### Event Tipi Naming Convention

- **Dot notation**: `scope.action` formatında
- **Küçük harf**: `snake_case` yerine `lowercase`
- **Açıklayıcı**: `content.created` ✅, `content.add` ❌

**Örnekler**:
- `workspace.member_invited`
- `workspace.member_accepted`
- `workspace.member_role_changed`
- `content.published`
- `content.scheduled`
- `publication.completed`
- `snapshot.generated`
- `snapshot.failed`
- `billing.subscription_renewed`

---

## Best Practices

### ✅ DO

1. **Ana işlem başarılı olduktan sonra logla**
   ```typescript
   const result = await someOperation();
   void logActivity({ type: "operation.completed", ... });
   ```

2. **Metadata'ya anlamlı bilgi ekle**
   ```typescript
   metadata: {
     contentId: content.id,
     title: content.title,        // ✅ Anlamlı
     platform: "INSTAGRAM",       // ✅ Context için önemli
     oldStatus: "draft",          // ✅ State change için
     newStatus: "published",
   }
   ```

3. **System event'lerde userId null bırak**
   ```typescript
   await logActivity({
     type: "snapshot.generated",
     userId: null, // ✅ System event
     actorType: "system",
     source: "worker",
   });
   ```

4. **Request objesini pass et (otomatik extraction için)**
   ```typescript
   void logActivity({
     type: "content.created",
     request, // ✅ requestId ve userId otomatik çıkarılır
   });
   ```

5. **Void kullan (fire-and-forget)**
   ```typescript
   void logActivity({ ... }); // ✅ Ana akışı bloklamaz
   ```

### ❌ DON'T

1. **Ana akışı bloklama**
   ```typescript
   // ❌ YANLIŞ - await edip hata kontrolü yapma
   await logActivity({ ... });
   ```

2. **Gereksiz metadata ekleme**
   ```typescript
   metadata: {
     timestamp: new Date(),  // ❌ createdAt zaten var
     id: content.id,         // ❌ scopeId zaten var
     random: "data",         // ❌ Gereksiz
   }
   ```

3. **Sensitive data ekleme**
   ```typescript
   metadata: {
     password: user.password,    // ❌ ASLA!
     apiKey: integration.key,    // ❌ ASLA!
     creditCard: payment.card,   // ❌ ASLA!
   }
   ```

4. **Her küçük işlem için loglama**
   ```typescript
   // ❌ Her GET request için loglamaya gerek yok
   // ✅ Sadece state-changing operations için logla
   ```

5. **Request olmadan manual userId çekme (gerek yok)**
   ```typescript
   // ❌ Gereksiz
   const userId = request.auth?.userId;
   void logActivity({ userId, ... });

   // ✅ Doğru - request'i pass et, otomatik çıkarılır
   void logActivity({ request, ... });
   ```

---

## Örnekler

### Örnek 1: Content Publication

```typescript
// apps/api/src/modules/content/content.routes.ts
app.post("/workspaces/:workspaceId/contents/:contentId/publish", {
  preHandler: [requirePermission(PERMISSIONS.CONTENT_PUBLISH)],
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const { workspaceId, contentId } = request.params;
  
  // Content'i yayınla
  const content = await contentService.publish(contentId);
  
  // Publication job'ını queue'ya ekle
  await enqueuePublicationJob({
    contentId: content.id,
    platform: content.platform,
  });

  // ✅ Activity event logla
  void logActivity({
    type: "content.publication_scheduled",
    workspaceId,
    scopeType: "content",
    scopeId: content.id,
    metadata: {
      contentId: content.id,
      title: content.title,
      platform: content.platform,
      scheduledAt: content.scheduledAt?.toISOString(),
    },
    request,
  });

  return reply.send({ success: true, data: content });
});
```

### Örnek 2: Publication Job Success

```typescript
// apps/api/src/core/queue/publication.queue.ts
async function processPublicationJob(job: Job<PublicationJobData>): Promise<void> {
  const { contentId, platform } = job.data;

  try {
    // Content'i platform'a publish et
    const publication = await publicationService.publish({
      contentId,
      platform,
    });

    // ✅ Activity event logla (system event)
    await logActivity({
      type: "publication.completed",
      workspaceId: publication.workspaceId,
      userId: null,
      actorType: "system",
      source: "worker",
      scopeType: "publication",
      scopeId: publication.id,
      metadata: {
        contentId: publication.contentId,
        platform: publication.platform,
        externalId: publication.externalId,
        publishedAt: publication.publishedAt.toISOString(),
      },
    });

    logger.info({ publicationId: publication.id }, "Publication completed");
  } catch (error) {
    // Hata durumunda
    await logActivity({
      type: "publication.failed",
      workspaceId: job.data.workspaceId,
      actorType: "system",
      source: "worker",
      scopeType: "content",
      scopeId: contentId,
      metadata: {
        contentId,
        platform,
        error: error.message,
      },
    });
    throw error;
  }
}
```

### Örnek 3: Member Role Change

```typescript
// apps/api/src/modules/workspace/workspace-member.routes.ts
app.patch("/workspaces/:workspaceId/members/:memberId/role", {
  preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_MANAGE)],
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const { workspaceId, memberId } = request.params;
  const { role } = request.body;

  // Eski role'ü al
  const oldMember = await workspaceMemberService.getById(memberId);

  // Role'ü değiştir
  const member = await workspaceMemberService.updateRole(memberId, role);

  // ✅ Activity event logla
  void logActivity({
    type: "workspace.member_role_changed",
    workspaceId,
    scopeType: "workspace",
    scopeId: workspaceId,
    metadata: {
      memberId: member.id,
      userId: member.userId,
      oldRole: oldMember.role,
      newRole: member.role,
      changedBy: request.auth?.userId,
    },
    request,
  });

  return reply.send({ success: true, data: member });
});
```

### Örnek 4: Brand Creation

```typescript
// apps/api/src/modules/brand/brand.routes.ts
app.post("/workspaces/:workspaceId/brands", {
  preHandler: [requirePermission(PERMISSIONS.BRAND_CREATE)],
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const { workspaceId } = request.params;
  const { name, slug, description } = request.body;

  // Brand oluştur
  const brand = await brandService.create({
    workspaceId,
    name,
    slug,
    description,
    createdBy: request.auth?.userId,
  });

  // ✅ Activity event logla
  void logActivity({
    type: "brand.created",
    workspaceId,
    scopeType: "brand",
    scopeId: brand.id,
    metadata: {
      brandId: brand.id,
      name: brand.name,
      slug: brand.slug,
    },
    request,
  });

  return reply.send({ success: true, data: brand });
});
```

---

## Activity Events Okuma/Sorgulama

### Backend'de Sorgulama

```typescript
// Son 7 günde workspace'teki event'ler
const events = await prisma.activityEvent.findMany({
  where: {
    workspaceId: "workspace-id",
    createdAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  },
  orderBy: { createdAt: "desc" },
  take: 100,
});

// Belirli bir content ile ilgili event'ler
const contentEvents = await prisma.activityEvent.findMany({
  where: {
    scopeType: "content",
    scopeId: "content-id",
  },
  orderBy: { createdAt: "desc" },
});

// Belirli event type'ları
const publicationEvents = await prisma.activityEvent.findMany({
  where: {
    type: {
      in: ["content.publication_scheduled", "publication.completed", "publication.failed"],
    },
    workspaceId: "workspace-id",
  },
  orderBy: { createdAt: "desc" },
});
```

### API Endpoint Örneği (İleride Eklenecek)

```typescript
// apps/api/src/modules/activity/activity.routes.ts
app.get("/workspaces/:workspaceId/activity", {
  preHandler: [requirePermission(PERMISSIONS.WORKSPACE_VIEW)],
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const { workspaceId } = request.params;
  const { limit = 50, offset = 0, type, scopeType } = request.query;

  const events = await prisma.activityEvent.findMany({
    where: {
      workspaceId,
      ...(type && { type }),
      ...(scopeType && { scopeType }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  return reply.send({ success: true, data: events });
});
```

---

## Checklist: Yeni Event Entegrasyonu

Yeni bir feature eklerken activity event loglamak için:

- [ ] Event tipini `ActivityEventType` enum'ına ekle
- [ ] Handler'da ana işlem başarılı olduktan sonra `logActivity()` çağır
- [ ] `request` objesini pass et (otomatik extraction için)
- [ ] `scopeType` ve `scopeId`'yi doğru set et
- [ ] Metadata'ya anlamlı bilgi ekle (sensitive data yok)
- [ ] System event ise `actorType: "system"` ve `source: "worker"` kullan
- [ ] `void logActivity()` kullan (fire-and-forget)

---

## Troubleshooting

### Event loglanmıyor

1. **Linter hatası var mı?** Event tipi enum'da tanımlı mı?
2. **Ana işlem başarılı mı?** Sadece başarılı işlemlerden sonra loglanır
3. **Database connection?** Prisma bağlantısı çalışıyor mu?

### Request ID otomatik çıkarılmıyor

- `request` objesini `logActivity()`'ye pass ettiğinizden emin olun
- Request ID hook'unun (`requestIdHook`) çalıştığından emin olun

### Metadata görünmüyor

- Metadata boş obje ise (`{}`) database'de `null` olarak kaydedilir (normal davranış)
- En az bir key-value pair olmalı

---

## İlerideki Geliştirmeler

- [ ] Activity feed API endpoint
- [ ] Frontend activity feed component
- [ ] Event aggregation ve analytics
- [ ] Event retention policy
- [ ] Activity events için pagination ve filtering
- [ ] WebSocket ile real-time activity feed updates

---

## Özet

Activity Events sistemi, BRINT uygulamasındaki tüm önemli aksiyonları loglamak için tasarlanmış bir global event store'dur. 

**Temel Kural**: Her state-changing operation'dan sonra `logActivity()` çağırın. Fire-and-forget, ana akışı bloklamaz.

**Hızlı Başlangıç**:
```typescript
import { logActivity } from "@/modules/activity/activity.service.js";

void logActivity({
  type: "your.event.type",
  workspaceId,
  scopeType: "workspace",
  scopeId: entityId,
  metadata: { ... },
  request,
});
```

---

**Sorularınız için**: Activity service kodunu inceleyin: `apps/api/src/modules/activity/activity.service.ts`

