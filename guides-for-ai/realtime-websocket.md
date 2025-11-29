# Realtime WebSocket Patterns & Guidelines

Bu dokümantasyon, BRINT projesinde Realtime WebSocket sistemi kullanırken takip edilmesi gereken pattern'leri, hataları ve çözümlerini açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Mimari](#mimari)
3. [Backend: Event Publish Etme](#backend-event-publish-etme)
4. [Frontend: Event Dinleme](#frontend-event-dinleme)
5. [Yeni Event Tipi Ekleme](#yeni-event-tipi-ekleme)
6. [Yaygın Hatalar ve Çözümleri](#yaygın-hatalar-ve-çözümleri)
7. [Debug ve Troubleshooting](#debug-ve-troubleshooting)
8. [Best Practices](#best-practices)

---

## Genel Bakış

BRINT projesinde realtime iletişim için WebSocket kullanıyoruz. Sistem şu bileşenlerden oluşuyor:

- **Backend**: Fastify + `@fastify/websocket` ile WebSocket endpoint (`/realtime`)
- **Backend Hub**: In-memory client registry ve event broadcasting
- **Frontend Client**: Singleton WebSocket client ile bağlantı yönetimi
- **Frontend Provider**: React context ile event subscription

### Event Akışı

```
Backend Event → publishEvent() → Hub → WebSocket → Frontend Client → NotificationsProvider → Toast/UI
```

---

## Mimari

### Backend Yapısı

```
apps/api/src/core/realtime/
├── events.ts          # Event tipleri ve payload tanımları
├── hub.ts             # Client registry ve publishEvent() fonksiyonu
└── realtime.routes.ts # WebSocket endpoint (/realtime)
```

### Frontend Yapısı

```
apps/web/
├── shared/realtime/
│   └── realtime-client.ts      # Singleton WebSocket client
└── features/notifications/
    ├── notifications-provider.tsx  # React provider (event → toast)
    └── notifications-types.ts      # Frontend event tipleri
```

### Mevcut Event Tipleri

1. **`notification.generic`** - Genel workspace bildirimleri
2. **`publication.completed`** - (Gelecek için) Content publication tamamlandı
3. **`publication.failed`** - (Gelecek için) Content publication başarısız

---

## Backend: Event Publish Etme

### Temel Kullanım

Herhangi bir backend modülünde event publish etmek için:

```typescript
import { publishEvent } from "@/core/realtime/hub";

// Basit notification
publishEvent({
  type: "notification.generic",
  payload: {
    workspaceId: "ws_123",
    message: "Yeni bir görev oluşturuldu",
    level: "info", // "info" | "success" | "error"
  },
});
```

### Örnek: Workspace Member Eklendiğinde

```typescript
// apps/api/src/modules/workspace/workspace-member.routes.ts

import { publishEvent } from "@/core/realtime/hub";

export async function addWorkspaceMember(...) {
  // ... member ekleme logic ...
  
  // Event publish et
  try {
    publishEvent({
      type: "notification.generic",
      payload: {
        workspaceId: workspace.id,
        message: `${memberName} workspace'e eklendi`,
        level: "success",
      },
    });
  } catch (err) {
    // Realtime publish hatası ana işlemi bozmamalı
    logger.error({ err, workspaceId }, "Failed to publish realtime notification");
  }
  
  return reply.status(201).send({ member });
}
```

### Önemli Notlar

1. **Error Handling**: `publishEvent()` hata fırlatırsa ana işlemi bozmamalı
2. **WorkspaceId Zorunlu**: `notification.generic` için `workspaceId` her zaman gerekli
3. **Non-blocking**: Event publish asenkron olmalı, response'u bekletmemeli

---

## Frontend: Event Dinleme

### NotificationsProvider Kullanımı

`NotificationsProvider` zaten `layout-client.tsx` içinde sarılmış durumda. Yeni bir feature'da event dinlemek için:

```typescript
// features/my-feature/components/my-component.tsx
"use client";

import { useEffect } from "react";
import { getRealtimeClient } from "@/shared/realtime/realtime-client";

export function MyComponent() {
  useEffect(() => {
    const client = getRealtimeClient();
    
    const unsubscribe = client.subscribe((event) => {
      if (event.type === "notification.generic") {
        const payload = event.payload as {
          workspaceId: string;
          message: string;
          level?: "info" | "success" | "error";
        };
        
        // Sadece mevcut workspace için işle
        if (payload.workspaceId !== currentWorkspaceId) {
          return;
        }
        
        // Custom logic burada
        console.log("Notification received:", payload.message);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [currentWorkspaceId]);
  
  return <div>...</div>;
}
```

### Connection Status Takibi

Badge veya connection indicator için:

```typescript
import { getRealtimeClient } from "@/shared/realtime/realtime-client";
import { useEffect, useState } from "react";

export function ConnectionIndicator() {
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const client = getRealtimeClient();
    
    // Initial status
    setIsConnected(client.isConnected());
    
    // Subscribe to status changes
    const unsubscribe = client.onConnectionStatusChange((connected) => {
      setIsConnected(connected);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return isConnected ? <span>🟢 Connected</span> : <span>🔴 Disconnected</span>;
}
```

---

## Yeni Event Tipi Ekleme

### 1. Backend: Event Tipi Tanımla

`apps/api/src/core/realtime/events.ts` dosyasına ekle:

```typescript
export type RealtimeEventType =
  | "notification.generic"
  | "publication.completed"
  | "publication.failed"
  | "task.created"  // YENİ
  | "task.completed"; // YENİ

// Payload tipi tanımla
export type TaskCreatedPayload = {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  createdBy: string;
};

export type TaskCompletedPayload = {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  completedBy: string;
};

// RealtimeEventPayloads'a ekle
export type RealtimeEventPayloads = {
  "notification.generic": NotificationGenericPayload;
  "publication.completed": PublicationCompletedPayload;
  "publication.failed": PublicationFailedPayload;
  "task.created": TaskCreatedPayload;      // YENİ
  "task.completed": TaskCompletedPayload;  // YENİ
};
```

### 2. Backend: Event Publish Et

```typescript
// apps/api/src/modules/task/task.routes.ts

import { publishEvent } from "@/core/realtime/hub";

export async function createTask(...) {
  // ... task oluşturma logic ...
  
  publishEvent({
    type: "task.created",
    payload: {
      workspaceId: workspace.id,
      taskId: task.id,
      taskTitle: task.title,
      createdBy: user.name,
    },
  });
  
  return reply.status(201).send({ task });
}
```

### 3. Frontend: Event Tipi Tanımla

`apps/web/features/notifications/notifications-types.ts`:

```typescript
export type TaskCreatedEvent = {
  type: "task.created";
  payload: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    createdBy: string;
  };
};
```

### 4. Frontend: Event Dinle

```typescript
// features/tasks/components/task-list.tsx

import { getRealtimeClient } from "@/shared/realtime/realtime-client";

useEffect(() => {
  const client = getRealtimeClient();
  
  const unsubscribe = client.subscribe((event) => {
    if (event.type === "task.created") {
      const payload = event.payload as TaskCreatedEvent["payload"];
      
      // Workspace kontrolü
      if (payload.workspaceId !== workspace.id) return;
      
      // Task listesini güncelle veya toast göster
      toast({
        description: `${payload.createdBy} yeni bir görev oluşturdu: ${payload.taskTitle}`,
      });
      
      // Listeyi refresh et
      refetchTasks();
    }
  });
  
  return () => unsubscribe();
}, [workspace.id]);
```

---

## Yaygın Hatalar ve Çözümleri

### 1. "WebSocket is closed before the connection is established"

**Neden:**
- Backend WebSocket endpoint çalışmıyor
- Token geçersiz veya expired
- Backend henüz başlamamış

**Çözüm:**
1. Backend'in çalıştığını kontrol et: `curl http://localhost:3001/health/basic`
2. Token'ın geçerli olduğunu kontrol et (console'da token'ı decode et)
3. Backend log'larını kontrol et: `WebSocket connection attempt` log'u görünüyor mu?

### 2. "Cannot read properties of undefined (reading 'on')"

**Neden:**
- `@fastify/websocket` v10'da handler signature değişti
- `(connection, request)` yerine `(socket, request)` kullanılmalı

**Çözüm:**
```typescript
// ❌ YANLIŞ (v9)
app.get("/realtime", { websocket: true }, async (connection, request) => {
  connection.socket.on("message", ...);
});

// ✅ DOĞRU (v10)
app.get("/realtime", { websocket: true }, async (socket, request) => {
  socket.on("message", ...);
});
```

### 3. Badge Görünmüyor

**Neden:**
- WebSocket bağlantısı kurulmamış
- `RealtimeStatusBadge` component'i render olmamış
- Workspace context hazır değil

**Çözüm:**
1. Browser console'da `[WebSocket] Connected successfully` log'unu kontrol et
2. `[RealtimeStatusBadge] Status changed: true` log'unu kontrol et
3. Network tab'da WebSocket connection'ı kontrol et
4. Workspace context'in `workspaceReady: true` olduğunu kontrol et

### 4. Event Gelmiyor

**Neden:**
- Backend'de `publishEvent()` çağrılmamış
- `workspaceId` eşleşmiyor
- Frontend'de event listener yok

**Çözüm:**
1. Backend log'larında `Published realtime event` log'unu kontrol et
2. Frontend console'da event listener'ın subscribe olduğunu kontrol et
3. `workspaceId`'nin backend ve frontend'de aynı olduğunu kontrol et
4. Network tab'da WebSocket message'larını kontrol et

### 5. Sürekli Reconnect Döngüsü

**Neden:**
- React StrictMode development'ta effect'leri iki kez çalıştırıyor
- Cleanup'ta `client.disconnect()` çağrılıyor
- Backend sürekli connection'ı kapatıyor

**Çözüm:**
```typescript
// ❌ YANLIŞ - Cleanup'ta disconnect etme
useEffect(() => {
  const client = getRealtimeClient();
  client.connect(workspaceId);
  
  return () => {
    client.disconnect(); // Bu singleton client'ı kapatır!
  };
}, [workspaceId]);

// ✅ DOĞRU - Sadece unsubscribe et
useEffect(() => {
  const client = getRealtimeClient();
  client.connect(workspaceId);
  const unsubscribe = client.subscribe(...);
  
  return () => {
    unsubscribe(); // Sadece listener'ı kaldır
  };
}, [workspaceId]);
```

### 6. "BullMQ: Your redis options maxRetriesPerRequest must be null"

**Neden:**
- BullMQ için Redis connection'da `maxRetriesPerRequest: null` gerekiyor
- Mevcut Redis instance'ı bu ayara sahip değil

**Çözüm:**
BullMQ için ayrı bir Redis connection oluştur:

```typescript
// apps/api/src/core/queue/bullmq.ts
import IORedis from "ioredis";
import { env } from "../../config/env.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ için zorunlu
});
```

---

## Debug ve Troubleshooting

### Backend Debug

1. **WebSocket Connection Log'ları:**
   ```typescript
   // realtime.routes.ts içinde
   logger.info({ url: request.url, ip: request.ip }, "WebSocket connection attempt");
   logger.info({ userId, workspaceId }, "WebSocket connection established");
   ```

2. **Event Publish Log'ları:**
   ```typescript
   // hub.ts içinde
   logger.info({
     eventType: event.type,
     workspaceId,
     sentCount,
     errorCount,
     totalClients: clients.size,
   }, "Published realtime event");
   ```

3. **Backend Terminal'de Kontrol:**
   - `WebSocket connection attempt` → Bağlantı denemesi
   - `WebSocket token verified` → Token doğrulandı
   - `WebSocket connection established` → Bağlantı kuruldu
   - `Published realtime event` → Event gönderildi

### Frontend Debug

1. **Console Log'ları:**
   ```typescript
   // realtime-client.ts içinde
   console.log("[WebSocket] Connected successfully", { workspaceId });
   console.log("[WebSocket] Closed", { code, reason });
   ```

2. **Browser DevTools:**
   - **Network Tab** → WS filter → `/realtime` connection'ı kontrol et
   - **Console Tab** → `[RealtimeStatusBadge]`, `[NotificationsProvider]` log'ları
   - **Application Tab** → LocalStorage → `access_token` kontrol et

3. **Connection Status Kontrolü:**
   ```typescript
   const client = getRealtimeClient();
   console.log("Is connected:", client.isConnected());
   console.log("Socket state:", client.socket?.readyState);
   // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
   ```

### Test Senaryoları

1. **Bağlantı Testi:**
   - Workspace sayfasına gir → Badge görünmeli
   - Network tab'da WebSocket connection görünmeli
   - Console'da `[WebSocket] Connected successfully` log'u olmalı

2. **Event Testi:**
   - Backend'de `publishEvent()` çağır
   - Frontend console'da event gelmeli
   - Toast görünmeli (eğer `notification.generic` ise)

3. **Reconnect Testi:**
   - Backend'i durdur → Badge kaybolmalı
   - Backend'i başlat → Badge tekrar görünmeli
   - Console'da reconnect log'ları görünmeli

---

## Best Practices

### 1. Event Naming Convention

- Format: `{domain}.{action}`
- Örnekler:
  - `task.created`
  - `task.completed`
  - `workspace.member.added`
  - `publication.completed`

### 2. Payload Design

- **WorkspaceId Her Zaman İlk Field:**
  ```typescript
  {
    workspaceId: string;  // İlk field - filtering için
    // ... diğer field'lar
  }
  ```

- **Minimal Payload:**
  - Sadece gerekli bilgileri gönder
  - Detaylar için frontend'de API çağrısı yap

### 3. Error Handling

- **Backend:**
  ```typescript
  try {
    publishEvent({ ... });
  } catch (err) {
    // Ana işlemi bozmamalı
    logger.error({ err }, "Failed to publish realtime event");
  }
  ```

- **Frontend:**
  ```typescript
  client.subscribe((event) => {
    try {
      // Event handling
    } catch (err) {
      logger.error({ err, event }, "Failed to handle realtime event");
    }
  });
  ```

### 4. Performance

- **Workspace Filtering:**
  - Her zaman `workspaceId` kontrolü yap
  - Gereksiz event processing'den kaçın

- **Connection Management:**
  - Singleton client kullan (her component'te yeni client oluşturma)
  - Cleanup'ta sadece unsubscribe et, disconnect etme

### 5. Security

- **Token Validation:**
  - Backend'de her WebSocket connection'da token doğrulanmalı
  - Expired token'lar reddedilmeli

- **Workspace Authorization:**
  - Event publish etmeden önce user'ın workspace'e erişimi olduğunu kontrol et
  - Frontend'de de workspaceId kontrolü yap

---

## Örnek Senaryolar

### Senaryo 1: Task Oluşturulduğunda Notification

**Backend:**
```typescript
// apps/api/src/modules/task/task.routes.ts
import { publishEvent } from "@/core/realtime/hub";

app.post("/workspaces/:workspaceId/tasks", async (request, reply) => {
  const task = await createTask(...);
  
  publishEvent({
    type: "notification.generic",
    payload: {
      workspaceId: task.workspaceId,
      message: `"${task.title}" görevi oluşturuldu`,
      level: "success",
    },
  });
  
  return reply.status(201).send({ task });
});
```

**Frontend:**
- `NotificationsProvider` otomatik olarak toast gösterecek
- Ekstra bir şey yapmaya gerek yok

### Senaryo 2: Custom Event Handling

**Backend:**
```typescript
publishEvent({
  type: "task.completed",
  payload: {
    workspaceId: task.workspaceId,
    taskId: task.id,
    taskTitle: task.title,
    completedBy: user.name,
  },
});
```

**Frontend:**
```typescript
// features/tasks/components/task-list.tsx
useEffect(() => {
  const client = getRealtimeClient();
  
  const unsubscribe = client.subscribe((event) => {
    if (event.type === "task.completed") {
      const payload = event.payload as TaskCompletedPayload;
      
      if (payload.workspaceId !== workspace.id) return;
      
      // Task listesini güncelle
      updateTaskStatus(payload.taskId, "completed");
      
      // Toast göster
      toast({
        description: `${payload.completedBy} "${payload.taskTitle}" görevini tamamladı`,
        variant: "default",
      });
    }
  });
  
  return () => unsubscribe();
}, [workspace.id]);
```

---

## Checklist: Yeni Event Ekleme

- [ ] Backend: `events.ts`'e event tipi ve payload ekle
- [ ] Backend: Event publish et (try-catch ile)
- [ ] Frontend: `notifications-types.ts`'e event tipi ekle (eğer custom handling gerekiyorsa)
- [ ] Frontend: Event listener ekle (eğer custom handling gerekiyorsa)
- [ ] Test: Backend'de event publish et
- [ ] Test: Frontend'de event geldiğini kontrol et
- [ ] Test: Workspace filtering çalışıyor mu?
- [ ] Test: Error handling çalışıyor mu?

---

## Sorun Giderme Akışı

1. **Badge Görünmüyor:**
   - Backend çalışıyor mu? → `curl http://localhost:3001/health/basic`
   - WebSocket endpoint çalışıyor mu? → Backend log'larını kontrol et
   - Token geçerli mi? → Console'da token'ı decode et
   - Workspace context hazır mı? → Console'da `workspaceReady: true` kontrol et

2. **Event Gelmiyor:**
   - Backend'de `publishEvent()` çağrıldı mı? → Backend log'larını kontrol et
   - `workspaceId` eşleşiyor mu? → Backend ve frontend'de aynı workspaceId mi?
   - Frontend'de listener var mı? → `client.subscribe()` çağrıldı mı?
   - WebSocket bağlantısı aktif mi? → Badge görünüyor mu?

3. **Sürekli Reconnect:**
   - Cleanup'ta `disconnect()` çağrılıyor mu? → Kaldır
   - Backend connection'ı kapatıyor mu? → Backend log'larını kontrol et
   - Token expired mı? → Yeni token al

---

## Kaynaklar

- Backend Hub: `apps/api/src/core/realtime/hub.ts`
- Backend Routes: `apps/api/src/core/realtime/realtime.routes.ts`
- Frontend Client: `apps/web/shared/realtime/realtime-client.ts`
- Notifications Provider: `apps/web/features/notifications/notifications-provider.tsx`
- Event Types: `apps/api/src/core/realtime/events.ts`

---

**Son Güncelleme:** 2025-01-29
**Versiyon:** 1.0

