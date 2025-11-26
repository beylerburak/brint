# Dev Workflow & AI Kuralları

Bu projede geliştirme süreci **Tiny Step (TS)** yaklaşımıyla yürütülür.

## Genel Kurallar

1. **Her zaman önce dokümanları oku**
   - AI, kod yazmaya başlamadan önce:
     - `docs/dev-workflow.md`
     - İlgili mimari dokümanlar (`backend-architecture.md`, `frontend-architecture.md`, `auth-claims-i18n.md`)
   - dosyalarını gözden geçirmek zorundadır.

2. **Tiny Step mantığı**
   - Her görev bir `TS-XX` adımıdır (örn: TS-24, TS-31).
   - AI, sadece istenen TS adımını uygular.
   - Bir TS tamamlanmadan başka TS'ye geçilmez.

3. **Test zorunluluğu**
   - Her TS adımının tanımında bir **Test** bölümü vardır.
   - Bir adım, test kriterleri sağlanmadan **tamamlanmış sayılmaz**.
   - Eğer test başarısızsa:
     - Aynı TS içinde kalınır.
     - Hata açıklanır ve düzeltilir.

4. **Dokümantasyon güncelleme**
   - Mimari kararlarda değişiklik olduğunda ilgili doküman güncellenmelidir:
     - Backend ile ilgili ise: `backend-architecture.md`
     - Frontend ile ilgili ise: `frontend-architecture.md`
     - Auth/Claims/i18n ile ilgili ise: `auth-claims-i18n.md`
   - Tiny Step listesi değişirse: `tiny-steps.md`.

5. **Hardcode yasağı**
   - Sabit değerler:
     - Önce `env` → sonra `config` → en son code.
   - Doğrudan magic string ve env erişimi yerine:
     - `src/config/*.ts` dosyaları kullanılmalıdır.

6. **İsimlendirme ve mimari**
   - Bu proje katmanlı ve feature-based mimari kullanır.
   - Yeni kod yazarken mevcut klasör yapısı ve isimlendirme kuralları takip edilir.
   - Rastgele yeni pattern icat edilmez; önce doküman, sonra kod.

## AI İçin Örnek Talimat

> “Proje `docs/` klasöründe tanımlı. Şimdi **TS-24**'e geçiyoruz.  
> Lütfen önce `docs/dev-workflow.md` ve ilgili mimari dokümanları oku, sonra sadece TS-24'ü uygula.  
> TS-24'ün test kriterlerini sağladıktan sonra dur ve rapor ver.”