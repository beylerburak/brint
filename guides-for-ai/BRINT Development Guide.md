Büyük resim: BRINT Development Guide yapısı

Bence ana rehberin iskeleti şöyle olmalı:
	1.	Genel prensipler
	2.	Backend domain & endpoint playbook
	3.	Queue / Worker / Realtime / Activity entegrasyon checklist’i
	4.	Frontend domain playbook (features/shared vs app)
	5.	Permission & security kuralları
	6.	Testing & observability kuralları
	7.	Referans dokümanlar (link hub)

Aşağıda her kısmın içini somut kurallarla dolduruyorum.

⸻

2) Genel Prensipler (AI’nin kafasına kazınacak 7 madde)

Bunlar rehberin en başında, net:
	1.	Her şey workspace-aware ve multi-tenant.
	•	X-Workspace-Id (veya auth context) yoksa, workspace scoped iş yapılmaz.
	•	Cross-tenant erişim asla tolerate edilmez.
	2.	Tüm public API’ler /v1 prefix’i altında.
	•	Backend: /v1/...
	•	Health gibi infra endpoint’ler prefixsiz (/health/live, /health/ready).
	3.	Tüm input validation Zod üzerinden.
	•	Body → validateBody(schema, request.body)
	•	Query → validateQuery(schema, request.query)
	•	Params → validateParams(schema, request.params)
	•	Error: code: "VALIDATION_ERROR" standardı.
	4.	Her önemli write operation bir ActivityEvent üretir.
	•	ActivityEvent = hem audit log hem AI-friendly event feed.
	•	Worker ve email event’leri de buraya bağlanır (zaten başladık).
	5.	Her yeni domain: backend + frontend + activity + permissions ile birlikte düşünülür.
	•	Sadece “endpoint yaz” yok; “domaini ürüne entegre et” var.
	6.	Test, log ve Sentry entegrasyonunu bozan PR kabul değil.
	•	En az happy path + 1-2 negatif case testi.
	•	Hata global error handler’dan geçer, Sentry’ye akar, log’da requestId olur.
	7.	AI için tüm rehberler docs/guides-for-ai/* altında.
	•	Tenant guard, pagination, realtime, activity, validation vs.
	•	Yeni rehberler de hep buraya.

⸻

3) Backend için “Yeni Domain / Endpoint” Playbook’u

Bu kısım Cursor’a “yeni domain geliştirirken ATILMASI GEREKEN ADIMLAR” olarak yazılmalı. Checklist gibi:

3.1. Yeni domain modülü açarken

Pattern:
	•	Klasör: apps/api/src/modules/<domain>/
	•	*.routes.ts
	•	*.service.ts
	•	*.repository.ts
	•	*.validation.ts (eğer schema’lar module-specific ise)
	•	*.types.ts ( gerekirse )

Kurallar:
	1.	Prisma model → ActivityEvent ile düşün:
	•	Model’i eklerken:
	•	id tipi
	•	workspaceId zorunlu mu?
	•	Soft delete planın var mı? (aşağıda anlatacağım, bence eklemeliyiz.)
	•	Index’leri düşün: (workspaceId, createdAt) çok defa lazım.
	2.	Repository’ler tenant-aware çalışmalı.
	•	Tenant guard rehberine uygun:
	•	where: { workspaceId, ... } as default.
	•	Cross-tenant erişim sadece özel admin case’lerinde, net yorumla.
	3.	Service katmanı:
	•	Business rule burada; route içinde business yok.
	•	Activity log çağrıları genelde service’ten yapılmalı, route değil.
	4.	Routes:
	•	Hepsi /v1/ prefix’i ile register edilir.
	•	Her route:
	•	permissionGuard ile korunur.
	•	requireWorkspaceMatch (veya tenant context) kullanır.
	•	validateBody / validateQuery / validateParams ile input’u parse eder.

⸻

3.2. Her yeni endpoint için “zorunlu” checklist

Bu çok kritik; bence bunu ayrı bir doc yapıp Cursor’a her görevde hatırlatmalısın:
docs/guides-for-ai/backend-endpoint-checklist.md

Bir endpoint eklerken AI şunları yapmak zorunda:
	1.	Path & versioning
	•	✅ Public API ise: /v1/<resource>
	•	✅ Infra/health ise prefixsiz.
	2.	Auth & permission
	•	✅ permissionGuard("<permission:key>") ekle.
	•	✅ Workspace endpoint ise:
	•	Route param: /:workspaceId/...
	•	Header: X-Workspace-Id ile eşleştir → tenant guard.
	3.	Validation
	•	✅ Body → bir Zod schema kullan:
	•	Eğer domain generic ise: packages/core-validation/src/schemas.ts
	•	Domain’e çok özel ise: apps/api/src/modules/<domain>/<domain>.validation.ts
	•	✅ Query → cursorPaginationQuerySchema vb.
	•	✅ Params → basit de olsa Zod.
	4.	Activity log (write operation’sa)
	•	✅ İş başarılı olduktan sonra:
	•	actorType: "user" | "system"
	•	source: "api" veya "worker"
	•	scopeType: "workspace" | "brand" | "content" vs.
	•	scopeId: ilgili entity id
	•	metadata: entity snapshot (ID, önemli alanlar).
	5.	Queue / async iş var mı?
	•	Örnek: content publish, report generate, snapshot, email dışındaki işler.
	•	✅ Sync iş long-running ise:
	•	BullMQ job’a dönüştür.
	•	Job enqueue edildiğinde ActivityEvent ( örn: content.publish_requested).
	•	Worker success/failure’da ActivityEvent (örn: content.publish_completed / _failed).
	6.	Realtime event (UI feedback gerekiyorsa)
	•	✅ Örnekler:
	•	Invite gönderildi → notification.generic.
	•	Publish tamamlandı → publication.completed.
	•	Event tipleri: core/realtime/events.ts içinde tanımlı olmalı.
	7.	Error handling
	•	✅ Tüm hatalar global error handler tarafından yakalanabilir olmalı.
	•	✅ Domain-specific hatalarda:
	•	code: anlamlı bir string (örn: CONTENT_NOT_FOUND).
	•	statusCode: doğru HTTP code.
	8.	Tests
	•	En azından:
	•	✅ 200 happy path
	•	✅ 400 validation error
	•	✅ 401/403 permission/tenant error
	•	✅ Liste endpoint ise min 1 pagination testi

⸻

4) Queue / Worker / Realtime / Activity entegrasyonu

Artık sende şu üçlü var: BullMQ, Realtime WebSocket, ActivityEvent.
Bunu AI için tek şemaya bağlayalım:

4.1. Yeni queue / job eklerken

Checklist (bunu da ayrı doc yapabilirsin: guides-for-ai/queue-and-worker-standard.md):
	1.	Queue tanımı
	•	Ortak helper: createQueue, createWorker (zaten mevcut).
	•	Yeni job tiplerini type-safe tanımla.
	2.	Enqueue tarafı
	•	Kullanıcı action’ından sonra:
	•	✅ Job’ı queue’ya ekle
	•	✅ ActivityEvent → <domain>.<action>_requested
	•	Metadata’ya job id, payload’ın özetini koy.
	3.	Worker tarafı
	•	✅ try/catch içinde gerçek işi yap.
	•	Başarılıysa:
	•	ActivityEvent → <domain>.<action>_completed
	•	Gerekliyse realtime event → UI toast / refresh.
	•	Fail ise:
	•	Retry (zaten policy var)
	•	Final failure’da:
	•	ActivityEvent → <domain>.<action>_failed
	•	Sentry.captureException(err)
	4.	Event naming convention
	•	email.*, auth.*, workspace.*, content.*, brand.* şeklinde namespace’ler.
	•	Zaten email ve auth için attık; aynı deseni content/brand için de devam ettiririz.

⸻

5) Frontend domain playbook

Backend kadar net olursa AI’nın saçmalama payı çok azalır.

5.1. Klasör yapısı (özet)
	•	apps/web/features/<domain>/
	•	api.ts → HTTP client + hooks (useGetX, useCreateX)
	•	components/ → domain-specific UI parçaları
	•	pages/ → sadece page composition (eğer feature seviyesinde tutuyorsan)
	•	hooks/ → domain-level hooks (state, modal vs)
	•	constants.ts
	•	types.ts
	•	apps/web/shared/
	•	api/ → generic http helpers, server/client fetch
	•	hooks/ → generic hooks
	•	realtime/ → websocket client
	•	utils/ → generic utils
	•	apps/web/app/[locale]/[workspace]/...
	•	Route dosyaları sadece:
	•	SSR data fetch
	•	Feature page component’ini çağırma

5.2. Yeni feature sayfası eklerken checklist
	1.	Route seviyesi
	•	Page: app/[locale]/[workspace]/<section>/page.tsx
	•	SSR gerekiyorsa:
	•	Server-side fetch helper kullan (serverFetch, getWorkspace*).
	•	Workspace context, permission hatası vs. SSR’de ele alınır.
	2.	Feature component
	•	features/<domain>/pages/<Name>Page.tsx
	•	Props: SSR’den gelen initialData
	•	State yönetimi:
	•	Query (React Query / custom hook)
	•	Mutations → success’te:
	•	Toaster
	•	Gerekirse local state update / refetch
	3.	API client
	•	features/<domain>/api.ts içinde:
	•	/v1/... endpoint’lere giden functions
	•	Workspace header’ı context’ten alan http client kullan.
	4.	Realtime
	•	Eğer event dinlemesi gerekiyorsa:
	•	shared/realtime client üzerinden subscribe
	•	Event type: backend’deki events.ts ile birebir isim.
	5.	UI / Design system
	•	Shadcn bileşenleri, mevcut design system’ine uymayan custom UI yazma.

⸻

6) Permission & Security kuralları

Burada ayrı bir “permissions-playbook” dokümanı çok işe yarar:
	•	Permission naming
	•	workspace:settings.manage
	•	studio:brand.view, studio:content.publish vs.
	•	Kural:
	•	Her yeni domain / action için permission düşünmeden endpoint yazılmaz.
	•	Permission registry’de tanımlanır → permission guard’lar, frontend feature flags vs. hepsi buradan beslenir.

Security tarafında şu kuralları da guide’da sabitle:
	•	Rate limit zaten aktif (loglarda görüyoruz).
→ Ama mutlaka rate limit config & rehberi ekleyelim:
hangi endpoint global, hangisi daha sıkı vs.
	•	Her sensitive iş için:
	•	ActivityEvent + Sentry
	•	Mümkünse IP / userAgent’in PII’ye kaçmadan loglanması.

⸻

7) Testing & Observability kuralları

Kısa ama net bir bölüm yeter:
	•	Backend:
	•	Yeni endpoint → en az 3 test:
	•	Happy path
	•	Validation error
	•	Auth/permission/tenant error
	•	Yeni helper / util → unit test
	•	Sentry:
	•	Worker + server error’ları otomatik gidiyor, bunu bozma.
	•	Yeni uzun akışlı işlerde (publish, snapshot) meaningful breadcrumb/log eklenebilir.
	•	Activity API:
	•	AI için “tek timeline kaynağı” olarak düşünülmeli.
	•	Yeni event tipleri activity.projection.ts’e eklenmeden merged edilmemeli.

⸻