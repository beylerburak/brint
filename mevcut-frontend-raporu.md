# Yığın ve altyapı
- Next.js 16 App Router + TypeScript, client ağırlıklı sayfalar; Tailwind CSS v4 + `tw-animate-css`; Radix UI/shadcn tabanlı bileşen seti (`components/ui`), Tabler Icons, Framer Motion/DnD Kit/TanStack Table desteği.
- Tema yönetimi `next-themes` üzerinden (`ThemeProvider`), bildirimler `sonner`; tipler ve kurallar `@brint/shared-config` paketlerinden geliyor (plan limitleri, platform kuralları, upload limitleri vb.).
- Uluslararasılaştırma `next-intl` ile (`lib/i18n`, `locales/en/common.json`, `locales/tr/...`), varsayılan locale `en`.
- API erişimi `lib/api-client.ts` altında merkezi, fetch tabanlı; WebSocketler için `hooks/use-websocket.ts` ve `hooks/use-publication-websocket.ts` bulunuyor.

# Dizin yapısı ve roller (apps/web)
- `app/`: App Router ağaç yapısı; `layout.tsx` temel tema/kök, `globals.css` tema tokenları; `[locale]` altında giriş/onboarding/workspace/brand sayfaları, nested layout’lar (`(workspace-pages)` ve brand layout).
- `features/`: Modüler alanlar.
  - `workspace/`: Sidebar, header, nav menü, workspace/brand switcher, upgrade dialog.
  - `brand/`: Brand header/nav ve brand oluşturma dialog’u.
  - `content/`: İçerik oluşturma modalı (Google Drive picker, publish options, DnD medya yönetimi, account selector, tag suggestions).
  - `settings/`: Settings nav ve alt sayfa iskeletleri.
- `components/`: Ortak UI (shadcn tabanlı), data-view (table/kanban/grafik), animasyon bileşenleri, form bileşenleri (login/signup), tema/language switcher.
- `contexts/`: `WorkspaceProvider` ile kullanıcı/workspace durumu.
- `hooks/`: Görünürlük, mobil algılama, WebSocket bağlantıları.
- `lib/`: API client, config, datetime utils, upload config, i18n yardımcıları, strict context helper.
- `config/`: Uygulama ad/şirket destek e-postası gibi public konfigürasyonlar.

# Yönlendirme ve sayfa haritası
- Middleware (`middleware.ts`): `next-intl` middleware’i ile locale ön-ekleri, cookie’deki `access_token` ile temel doğrulama ve onboarding yönlendirmeleri; kök `/` veya `/${locale}` girişini locale’ye göre login’e veya onboarding’e yönlendiriyor.
- Locale katmanı (`app/[locale]/layout.tsx`): `NextIntlClientProvider` ile mesajları sağlıyor.
- Giriş/onboarding:
  - `app/[locale]/page.tsx`: `/me` çağrısı sonrası ilk workspace’e veya `/onboarding`/`/login`’e yönlendiren client bileşeni.
  - `app/[locale]/login/page.tsx` ve `components/login-form.tsx`: email/parola ile giriş formu.
  - `app/[locale]/signup/page.tsx`: signup formu + placeholder görsel.
  - `app/[locale]/onboarding/page.tsx`: onboarding tamamlanma akışı, workspace kontrolü ve logout butonu.
- Workspace seviyesi:
  - `app/[locale]/[workspace]/layout.tsx`: `WorkspaceProvider` + route transition.
  - `(workspace-pages)/layout.tsx`: Sidebar (`AppSidebar`) ve `SiteHeader` sarmalayıcısı, ana içerik gövdesi.
  - `(workspace-pages)/home`: workspace karşılama ve plan bilgisi.
  - `(workspace-pages)/brands`: brand listesi, brand oluşturma dialog’u, plan limit kontrolleri, upgrade dialog entegrasyonu.
  - `(workspace-pages)/settings`: genel/profile/workspace/integrations alt sayfalarına yönlendirme ve layout.
- Brand seviyesi:
  - `app/[locale]/[workspace]/[brandSlug]/layout.tsx`: `BrandHeader` ve `BrandNavMenu`.
  - Alt sayfalar: `home`, `profile`, `tasks` (table/kanban ve websocket entegrasyonu), `calendar`, `analytics`, `social-accounts`, `publish`.

# Durum ve veri yönetimi
- `WorkspaceProvider` (client): `/me` üzerinden kullanıcı + workspace özetini çekiyor, URL’deki `workspace` paramına göre mevcut workspace’i seçiyor; workspace detayları gerektiğinde `apiClient.getWorkspace`.
- `apiClient`: Fetch tabanlı wrapper, basit TTL cache ve pending-request deduplikasyonu; domain çağrıları (auth, onboarding, workspace, brand, tasks, media, social accounts, integrations, content) tek dosyada toplu.
- WebSocket: `hooks/use-websocket` ve `hooks/use-publication-websocket` ile task/publication olayları için reconnect’li WS bağlantıları; URL’ler `NEXT_PUBLIC_API_URL` veya `http://localhost:3001` baz alınarak kuruluyor.
- İçerik oluşturma: `ContentCreationModal` + `use-content-form-state` + `use-media-manager` + `use-publish-options` + `use-tag-suggestions`; medya upload/delete ve Google Drive import akışları `apiClient` ile.
- Görevler: `app/[locale]/[workspace]/[brandSlug]/tasks/page.tsx` içinde tablo/kanban veri dönüşümleri, websocket event’leri, sonsuz scroll ve filtreleme.

# UI ve tasarım sistemi
- `components/ui`: shadcn türevi button/input/card/dialog/select/sheet/slider/navigation-menu/sidebar vb. bileşenler.
- `components/data-view`: tablo/kanban/grafik/detay modal birleşik görünümü; `use-kanban-columns` gibi yardımcı hook’lar.
- `components/animate-ui`: cursor efektleri vb.
- Tema değişimi ve locale switcher `components/theme-toggle.tsx` ve `components/language-switcher.tsx` ile sağlanıyor; global renk tokenları `globals.css` içinde tanımlı.

# Uluslararasılaştırma
- Locale listesi `lib/i18n/locales.ts` (`en`, `tr`); `lib/i18n/i18n.ts` dinamik mesaj yükleme yapıyor.
- Çeviriler `locales/en/common.json` içinde yoğun; `next-intl` `useTranslations` ile sayfa ve bileşenlerde kullanılıyor, bazı sayfalarda statik İngilizce kopyalar da mevcut.
