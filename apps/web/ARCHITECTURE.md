# Frontend Architecture (v1)

## 1. Katmanlar

### 1.1 `app/`

Sadece routing ve layout katmanı.

**Görevleri:**
- `page.tsx` → route entry component
- `layout.tsx` / `layout-client.tsx` → shell, layout, provider bağlama

**Yapmayacakları:**
- Domain iş mantığı
- Doğrudan API çağrısı (bu işleri `features` ve `shared/api` üstlenir)

### 1.2 `features/<feature-name>/`

Net bir iş alanını temsil eder:
- Ör: `auth`, `space`, `subscription`, `settings`, ileride `brand-studio`, `content-planner` vb.

**İç yapısı (genel şablon):**

```
features/<name>/
  api/         # Bu feature'a özel API client'lar
  components/  # Bu feature'a özel UI
  context/     # Bu feature'ın React context'leri
  hooks/       # Bu feature'a özel hook'lar
  utils/       # Domain mantığı, hesaplamalar
  config/      # Sabitler, enum'lar, limitler
  navigation/  # Bu feature'a özel navigation/menü
  types.ts     # Domain tipleri
```

**Kural:**
- Bir component başka feature'ı bilmemeli (ör: `features/space` içi `subscription` domain'ini doğrudan kullanmamalı; gerekiyorsa `shared/api` üzerinden gider).

### 1.3 `shared/`

Tüm uygulamanın paylaştığı altyapı katmanı:

- `shared/http` → http client, request/response tipleri
- `shared/config` → env, appConfig, type'lar
- `shared/api` → birden fazla feature'ın kullandığı yüksek seviye API helper'ları
- `shared/auth` → token storage, auth infra
- `shared/i18n` → dil, locale, i18n ayarları
- `shared/hooks` → feature bağımsız hook'lar (örn. `use-mobile`, `use-copy`, `use-auto-height`…)
- `shared/utils` → logger + generic util fonksiyonlar
- `shared/lib` → generic pattern/helper (örn. `getStrictContext`)

**Kural:**
Buradaki hiçbir şey sadece tek bir feature'a özel olmamalı.

### 1.4 `components/`

UI primitives ve generic UI:

- `components/ui` → shadcn primitifleri
- `components/animate-ui` → animasyonlu/landing odaklı component'ler
- Diğer global UI bileşenleri (ör: `protected-layout`, `theme-toggle`)

**Kural:**
İş mantığı bilmez; domain kavramlarından haberi olsa bile (ör: workspace adı) API ve state işlerini `features` üstlenir, component sadece prop alır.

### 1.5 `hooks/` (root) ve `lib/` (root)

Legacy / geçici alan kabul edilecek.

**Kurallar:**

- `apps/web/hooks/*` içindeki kodlar:
  - Eğer tamamen generic ise → `shared/hooks` altına taşınacak.
  - Eğer belli bir feature'a aitse → ilgili `features/<name>/hooks` altına taşınacak.

- `apps/web/lib/*` içindeki kodlar:
  - Generic, feature bağımsız helper'lar → `shared/utils` veya `shared/lib` altına taşınacak.

**Uzun vadede:** Root `hooks/` ve `lib/` klasörleri boş olacak ve kaldırılacak.

