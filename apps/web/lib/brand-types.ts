/**
 * Brand Profile Types
 *
 * TypeScript types for brand profile data, matching backend schema
 */

// ============================================================================
// Brand Contact Channel Types
// ============================================================================

export type BrandContactType = 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'ADDRESS' | 'WEBSITE';

export type BrandContactChannelDto = {
  id: string;
  type: BrandContactType;
  label?: string | null;
  value: string;
  isPrimary: boolean;
  order: number;
  metaJson?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateBrandContactChannelInput = {
  type: BrandContactType;
  label?: string | null;
  value: string;
  isPrimary?: boolean;
  order?: number;
  metaJson?: Record<string, unknown> | null;
};

export type UpdateBrandContactChannelInput = Partial<CreateBrandContactChannelInput>;

// ============================================================================
// Brand Profile Data Types (matches BrandProfileDataSchema)
// ============================================================================

export type BrandProfileData = {
  identity?: {
    tagline?: string | null;
    mission?: string | null;
    vision?: string | null;
  };

  quickFacts?: {
    workingHours?: string | null; // Özet gösterim: "Mon-Fri 09:00-18:00"
    workingHoursDetail?: {
      monday?: { isOpen: boolean; startTime: string; endTime: string };
      tuesday?: { isOpen: boolean; startTime: string; endTime: string };
      wednesday?: { isOpen: boolean; startTime: string; endTime: string };
      thursday?: { isOpen: boolean; startTime: string; endTime: string };
      friday?: { isOpen: boolean; startTime: string; endTime: string };
      saturday?: { isOpen: boolean; startTime: string; endTime: string };
      sunday?: { isOpen: boolean; startTime: string; endTime: string };
    };
  };

  business?: {
    businessType?: 'Service' | 'Product' | 'Both';
    marketType?: 'B2B' | 'B2C' | 'B2B2C';
    deliveryModel?: string;
    coreServices?: string[];
    coreProducts?: string[];
    salesChannels?: string[];
    transactionTypes?: string[];
    structureType?: 'Single-location' | 'Multi-branch' | 'Franchise' | 'Online-only';
    hqLocation?: string | null;
    serviceRegions?: string[];
  };

  audience?: {
    personas?: Array<{
      id: string;
      name: string;
      description?: string;
      ageRange?: string;
      painPoints?: string[];
    }>;
    positioning?: {
      category?: string;
      usps?: string[];
      competitors?: Array<{
        id: string;
        name: string;
        note?: string;
      }>;
    };
  };

  voice?: {
    toneScales?: {
      formalInformal?: number;
      seriousPlayful?: number;
      simpleComplex?: number;
      warmNeutral?: number;
    };
    doSay?: string[];
    dontSay?: string[];
  };

  rules?: {
    allowedTopics?: string[];
    forbiddenTopics?: string[];
    crisisGuidelines?: string[];
    legalConstraints?: Array<{
      id: string;
      title: string;
      description: string;
    }>;
  };

  assets?: {
    brandColors?: {
      primary?: string[];
      accent?: string[];
    };
    visualGuidelines?: string[];
  };

  aiConfig?: {
    defaultLanguage?: string;
    contentLength?: {
      min?: number;
      max?: number;
      unit?: 'chars' | 'words';
    };
    ctaStyle?: string;
    preferredPlatforms?: string[];
  };
};

// ============================================================================
// Brand Profile DTO
// ============================================================================

export type BrandProfileDto = {
  id: string;
  version: string;
  optimizationScore?: number | null;
  optimizationScoreUpdatedAt?: string | null;
  aiSummaryShort?: string | null;
  aiSummaryDetailed?: string | null;
  data: BrandProfileData | null;
  lastEditedAt: string;
  lastAiRefreshAt?: string | null;
};

// ============================================================================
// Brand Detail DTO (full brand with profile and contacts)
// ============================================================================

export type BrandDetailDto = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  primaryLocale?: string | null;
  timezone?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  logoMediaId?: string | null;
  logoUrl?: string | null;
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
  contactChannels: BrandContactChannelDto[];
  profile: BrandProfileDto | null;
};

// ============================================================================
// Update Input Types
// ============================================================================

export type UpdateBrandProfileInput = {
  profileData: BrandProfileData;
  optimizationScore?: number | null;
};

