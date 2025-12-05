/**
 * Brand Optimization Score Calculator
 * 
 * Calculates a 0-100 score for brand profile completeness and quality.
 * Provides detailed breakdown and issues for each section.
 */

import type { BrandProfileData } from '../domain/brand-profile.schema.js';

type ContactChannelType = 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'ADDRESS' | 'WEBSITE';

interface ContactChannel {
  id: string;
  type: ContactChannelType;
  label: string | null;
  value: string;
  isPrimary: boolean;
  order: number;
  metaJson: any | null;
}

interface BrandProfile {
  id: string;
  version: string;
  data: BrandProfileData | any;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  primaryLocale?: string | null;
  timezone?: string | null;
  status: string;
  logoMediaId?: string | null;
  logoUrl?: string | null;
  mediaCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  contactChannels?: ContactChannel[];
  profile?: BrandProfile | null;
}

interface SectionScore {
  section: string;
  score: number;
  maxScore: number;
  issues: string[];
}

interface BrandOptimizationResult {
  score: number;
  maxScore: number; // 100
  percentage: number; // 0-100
  breakdown: SectionScore[];
}

/** Helper: dolu string mi? */
const hasContent = (value: unknown, minLength = 1): boolean => {
  if (typeof value !== 'string') return false;
  return value.trim().length >= minLength;
};

export function calculateBrandOptimizationScore(
  brand: Brand
): BrandOptimizationResult {
  const breakdown: SectionScore[] = [];
  const profileData = brand.profile?.data ?? {};

  // 1) BRAND TEMEL BİLGİLER (15)
  (() => {
    let score = 0;
    const maxScore = 15;
    const issues: string[] = [];

    // Temel alanlar
    const basicsMissing: string[] = [];
    if (!hasContent(brand.name)) basicsMissing.push('İsim');
    if (!hasContent(brand.slug)) basicsMissing.push('Slug');
    if (!hasContent(brand.description)) basicsMissing.push('Açıklama');
    if (!hasContent(brand.industry)) basicsMissing.push('Sektör');

    if (basicsMissing.length === 0) {
      score += 4;
    } else {
      issues.push(
        `Temel brand alanları eksik: ${basicsMissing.join(', ')}`
      );
    }

    // Konum & locale
    const locationMissing: string[] = [];
    if (!hasContent(brand.country)) locationMissing.push('Ülke');
    if (!hasContent(brand.city)) locationMissing.push('Şehir');
    if (!hasContent(brand.primaryLocale)) locationMissing.push('Dil/Locale');
    if (!hasContent(brand.timezone)) locationMissing.push('Zaman dilimi');

    if (locationMissing.length === 0) {
      score += 4;
    } else {
      issues.push(
        `Konum/locale ile ilgili eksikler var: ${locationMissing.join(', ')}`
      );
    }

    // Logo
    if (hasContent(brand.logoUrl)) {
      score += 4;
    } else {
      issues.push('Markaya ait logo (logoUrl) tanımlı değil.');
    }

    // Contact channels (PHONE, EMAIL, WEBSITE)
    const channels = brand.contactChannels ?? [];
    const hasPhone = channels.some((c) => c.type === 'PHONE');
    const hasEmail = channels.some((c) => c.type === 'EMAIL');
    const hasWebsite = channels.some((c) => c.type === 'WEBSITE');

    if (hasPhone) score += 1.5;
    else issues.push('En az bir telefon iletişim kanalı önerilir.');

    if (hasEmail) score += 1.5;
    else issues.push('En az bir e-posta iletişim kanalı önerilir.');

    if (hasWebsite) score += 2;
    else issues.push('En az bir web sitesi adresi önerilir.');

    breakdown.push({
      section: 'Brand Temel Bilgiler',
      score,
      maxScore,
      issues,
    });
  })();

  // 2) IDENTITY (20)
  (() => {
    let score = 0;
    const maxScore = 20;
    const issues: string[] = [];

    const identity = profileData.identity ?? {};

    // Tagline
    if (hasContent(identity.tagline)) {
      score += 4;
      if (hasContent(identity.tagline, 20)) {
        score += 2;
      } else {
        issues.push('Tagline biraz kısa görünüyor; daha açıklayıcı olabilir.');
      }
    } else {
      issues.push('Tagline tanımlı değil.');
    }

    // Mission
    if (hasContent(identity.mission)) {
      score += 6;
      if (hasContent(identity.mission, 60)) {
        score += 3;
      } else {
        issues.push(
          'Misyon metni var ama kısa; markanın amacını biraz daha açabilirsin.'
        );
      }
    } else {
      issues.push('Misyon metni tanımlı değil.');
    }

    // Vision
    if (hasContent(identity.vision)) {
      score += 6;
      if (hasContent(identity.vision, 60)) {
        score += 3;
      } else {
        issues.push(
          'Vizyon metni var ama kısa; uzun vadeli hedefler daha net yazılabilir.'
        );
      }
    } else {
      issues.push('Vizyon metni tanımlı değil.');
    }

    breakdown.push({
      section: 'Kimlik (Identity)',
      score,
      maxScore,
      issues,
    });
  })();

  // 3) QUICK FACTS / ÇALIŞMA SAATLERİ (10)
  (() => {
    let score = 0;
    const maxScore = 10;
    const issues: string[] = [];

    const quickFacts = profileData.quickFacts ?? {};

    if (hasContent(quickFacts.workingHours)) {
      score += 2;
    } else {
      issues.push('Genel çalışma saatleri (workingHours) boş.');
    }

    const detail = quickFacts.workingHoursDetail;
    if (!detail) {
      issues.push('Çalışma saatleri detay bazında (gün gün) tanımlı değil.');
    } else {
      const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      const hasAllDays = days.every((d) => detail[d]);
      if (hasAllDays) {
        score += 4;
      } else {
        issues.push(
          'Çalışma saatleri detayında tüm günler tanımlı değil (monday..sunday).'
        );
      }

      const openDaysCount = days.filter(
        (d) => detail[d]?.isOpen === true
      ).length;
      if (openDaysCount >= 5) {
        score += 4;
      } else {
        issues.push(
          'Haftada en az 5 gün açık olan gün bilgisi belirgin değil.'
        );
      }
    }

    breakdown.push({
      section: 'Operasyon & Çalışma Saatleri',
      score,
      maxScore,
      issues,
    });
  })();

  // 4) BUSINESS (20)
  (() => {
    let score = 0;
    const maxScore = 20;
    const issues: string[] = [];

    const business = profileData.business ?? {};

    if (hasContent(business.businessType)) {
      score += 3;
    } else {
      issues.push('businessType tanımlı değil (ör. Service, Product).');
    }

    if (hasContent(business.marketType)) {
      score += 3;
    } else {
      issues.push('marketType tanımlı değil (ör. B2B, B2C).');
    }

    if (hasContent(business.deliveryModel)) {
      score += 3;
    } else {
      issues.push(
        'deliveryModel tanımlı değil (ör. Online, Yerinde, Hibrit).'
      );
    }

    const coreServices = business.coreServices ?? [];
    if (coreServices.length > 0) {
      score += 4;
      if (coreServices.length >= 3) {
        score += 2;
      } else {
        issues.push(
          "Ana hizmet sayısı 3'ten az; önemli hizmetleri biraz daha detaylandırabilirsin."
        );
      }
    } else {
      issues.push('coreServices listesi boş.');
    }

    const serviceRegions = business.serviceRegions ?? [];
    if (serviceRegions.length > 0) {
      score += 3;
    } else {
      issues.push('serviceRegions (hizmet verilen bölgeler) tanımlı değil.');
    }

    const salesChannels = business.salesChannels ?? [];
    if (salesChannels.length > 0) {
      score += 2;
    } else {
      issues.push('salesChannels (satış kanalları) tanımlı değil.');
    }

    breakdown.push({
      section: 'İş Modeli & Operasyon (Business)',
      score,
      maxScore,
      issues,
    });
  })();

  // 5) AUDIENCE & POSITIONING (20)
  (() => {
    let score = 0;
    const maxScore = 20;
    const issues: string[] = [];

    const audience = profileData.audience ?? {};

    const personas = audience.personas ?? [];
    if (personas.length > 0) {
      score += 7;
      if (personas.length >= 2) {
        score += 2;
      } else {
        issues.push(
          'Sadece 1 persona tanımlı; farklı segmentler için ek personelar eklenebilir.'
        );
      }

      const personasWithPainPoints = personas.filter(
        (p: any) => (p.painPoints ?? []).length > 0
      ).length;
      if (personasWithPainPoints > 0) {
        score += Math.min(personasWithPainPoints, 3); // max +3
      } else {
        issues.push("Personaların pain point'leri doldurulmamış.");
      }
    } else {
      issues.push('Hiç persona tanımlı değil.');
    }

    const positioning = audience.positioning ?? {};
    if (hasContent(positioning.category)) {
      score += 3;
    } else {
      issues.push('positioning.category tanımlı değil (ör. Digital Experience Studio).');
    }

    const usps = positioning.usps ?? [];
    if (usps.length >= 2) {
      score += 4;
      if (usps.length >= 3) {
        score += 1;
      } else {
        issues.push(
          "USP sayısı 3'ten az; farklılaşma noktaları biraz daha çoğaltılabilir."
        );
      }
    } else if (usps.length > 0) {
      score += 2;
      issues.push('USP sayısı düşük; en az 2-3 güçlü USP önerilir.');
    } else {
      issues.push('USP (farklılaştırıcı değer önerileri) tanımlı değil.');
    }

    const competitors = positioning.competitors ?? [];
    if (competitors.length > 0) {
      score += 3;
    } else {
      issues.push('Rakip listesi tanımlı değil; 1-3 referans rakip faydalı olur.');
    }

    breakdown.push({
      section: 'Hedef Kitle & Konumlanma (Audience & Positioning)',
      score,
      maxScore,
      issues,
    });
  })();

  // 6) VOICE & RULES (15)
  (() => {
    let score = 0;
    const maxScore = 15;
    const issues: string[] = [];

    const voice = profileData.voice ?? {};
    const rules = profileData.rules ?? {};

    const toneScales = voice.toneScales ?? {};
    const requiredScales = [
      'formalInformal',
      'seriousPlayful',
      'simpleComplex',
      'warmNeutral',
    ];
    const hasAllScales = requiredScales.every(
      (key) => typeof toneScales[key] === 'number'
    );
    if (hasAllScales) {
      score += 5;
    } else {
      issues.push(
        'toneScales içinde tüm ölçekler tanımlı değil (formalInformal, seriousPlayful, simpleComplex, warmNeutral).'
      );
    }

    const doSay = voice.doSay ?? [];
    if (doSay.length >= 2) {
      score += 3;
      if (doSay.length >= 3) {
        score += 2;
      } else {
        issues.push(
          "doSay listesi var ama 3'ten az madde içeriyor; daha net örnekler eklenebilir."
        );
      }
    } else if (doSay.length > 0) {
      score += 2;
      issues.push('doSay listesi zayıf; en az 2-3 madde önerilir.');
    } else {
      issues.push('doSay listesi boş.');
    }

    const dontSay = voice.dontSay ?? [];
    if (dontSay.length >= 2) {
      score += 3;
    } else if (dontSay.length > 0) {
      score += 1;
      issues.push(
        "dontSay listesi az; kaçınılması gereken ifadeler biraz daha çoğaltılabilir."
      );
    } else {
      issues.push('dontSay listesi boş.');
    }

    const allowedTopics = rules.allowedTopics ?? [];
    if (allowedTopics.length > 0) {
      score += 2;
    } else {
      issues.push('rules.allowedTopics boş; AI hangi konularda konuşabilir net değil.');
    }

    breakdown.push({
      section: 'Dil, Voice & Kurallar',
      score,
      maxScore,
      issues,
    });
  })();

  // GENEL TOPLAM
  const maxScore = breakdown.reduce((sum, b) => sum + b.maxScore, 0);
  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);

  return {
    score: Math.round(totalScore),
    maxScore,
    percentage,
    breakdown,
  };
}

