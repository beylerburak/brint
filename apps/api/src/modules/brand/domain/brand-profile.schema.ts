/**
 * Brand Profile Data Schema
 *
 * Defines the structure of brand profile JSON data stored in BrandProfile.data
 * Includes TypeScript types and Zod validation schemas for type safety.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schema Definition
// ============================================================================

export const BrandProfileDataSchema = z.object({
  identity: z
    .object({
      tagline: z.string().max(300).nullable().optional(),
      mission: z.string().max(1000).nullable().optional(),
      vision: z.string().max(1000).nullable().optional(),
    })
    .optional(),

  quickFacts: z
    .object({
      workingHours: z.string().max(200).nullable().optional(), // Özet: "Mon-Fri 09:00-18:00"
      workingHoursDetail: z
        .object({
          monday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
          tuesday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
          wednesday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
          thursday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
          friday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
          saturday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
          sunday: z.object({ isOpen: z.boolean(), startTime: z.string().max(10), endTime: z.string().max(10) }).optional(),
        })
        .optional(),
    })
    .optional(),

  business: z
    .object({
      businessType: z.enum(['Service', 'Product', 'Both']).optional(),
      marketType: z.enum(['B2B', 'B2C', 'B2B2C']).optional(),
      deliveryModel: z.string().max(200).optional(),
      coreServices: z.array(z.string().max(200)).optional(),
      coreProducts: z.array(z.string().max(200)).optional(),
      salesChannels: z.array(z.string().max(200)).optional(),
      transactionTypes: z.array(z.string().max(200)).optional(),
      structureType: z
        .enum(['Single-location', 'Multi-branch', 'Franchise', 'Online-only'])
        .optional(),
      hqLocation: z.string().max(300).nullable().optional(),
      serviceRegions: z.array(z.string().max(300)).optional(),
    })
    .optional(),

  audience: z
    .object({
      personas: z
        .array(
          z.object({
            id: z.string(),
            name: z.string().max(200),
            description: z.string().max(500).optional(),
            ageRange: z.string().max(100).optional(),
            painPoints: z.array(z.string().max(200)).optional(),
          })
        )
        .optional(),
      positioning: z
        .object({
          category: z.string().max(200).optional(),
          usps: z.array(z.string().max(200)).optional(),
          competitors: z
            .array(
              z.object({
                id: z.string(),
                name: z.string().max(200),
                note: z.string().max(300).optional(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),

  voice: z
    .object({
      toneScales: z
        .object({
          formalInformal: z.number().min(0).max(1).optional(),
          seriousPlayful: z.number().min(0).max(1).optional(),
          simpleComplex: z.number().min(0).max(1).optional(),
          warmNeutral: z.number().min(0).max(1).optional(),
        })
        .optional(),
      doSay: z.array(z.string().max(300)).optional(),
      dontSay: z.array(z.string().max(300)).optional(),
    })
    .optional(),

  rules: z
    .object({
      allowedTopics: z.array(z.string().max(200)).optional(),
      forbiddenTopics: z.array(z.string().max(200)).optional(),
      crisisGuidelines: z.array(z.string().max(300)).optional(),
      legalConstraints: z
        .array(
          z.object({
            id: z.string(),
            title: z.string().max(200),
            description: z.string().max(1000),
          })
        )
        .optional(),
    })
    .optional(),

  assets: z
    .object({
      brandColors: z
        .object({
          primary: z
            .array(z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/))
            .optional(),
          accent: z
            .array(z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/))
            .optional(),
        })
        .optional(),
      visualGuidelines: z.array(z.string().max(300)).optional(),
    })
    .optional(),

  aiConfig: z
    .object({
      defaultLanguage: z.string().max(10).optional(), // "tr-TR"
      contentLength: z
        .object({
          min: z.number().int().positive().optional(),
          max: z.number().int().positive().optional(),
          unit: z.enum(['chars', 'words']).optional(),
        })
        .optional(),
      ctaStyle: z.string().max(200).optional(),
      preferredPlatforms: z.array(z.string().max(100)).optional(),
    })
    .optional(),
});

// ============================================================================
// TypeScript Type (inferred from Zod schema)
// ============================================================================

export type BrandProfileData = z.infer<typeof BrandProfileDataSchema>;

// ============================================================================
// Contact Channel DTOs
// ============================================================================

export const BrandContactChannelSchema = z.object({
  id: z.string(),
  type: z.enum(['PHONE', 'WHATSAPP', 'EMAIL', 'ADDRESS', 'WEBSITE']),
  label: z.string().nullable().optional(),
  value: z.string(),
  isPrimary: z.boolean(),
  order: z.number(),
  metaJson: z.record(z.unknown()).nullable().optional(),
});

export type BrandContactChannelDto = z.infer<typeof BrandContactChannelSchema>;

// ============================================================================
// Brand Profile DTO
// ============================================================================

export type BrandProfileDto = {
  id: string;
  version: string;
  optimizationScore: number | null;
  optimizationScoreUpdatedAt: string | null;
  aiSummaryShort: string | null;
  aiSummaryDetailed: string | null;
  data: BrandProfileData | null;
  lastEditedAt: string;
  lastAiRefreshAt: string | null;
};

// ============================================================================
// Create/Update Input Schemas
// ============================================================================

export const CreateBrandContactChannelSchema = z.object({
  type: z.enum(['PHONE', 'WHATSAPP', 'EMAIL', 'ADDRESS', 'WEBSITE']),
  label: z.string().max(100).nullable().optional(),
  value: z.string().min(1).max(500),
  isPrimary: z.boolean().optional().default(false),
  order: z.number().int().min(0).optional().default(0),
  metaJson: z.record(z.unknown()).nullable().optional(),
});

export type CreateBrandContactChannelInput = z.infer<typeof CreateBrandContactChannelSchema>;

export const UpdateBrandContactChannelSchema = z.object({
  type: z.enum(['PHONE', 'WHATSAPP', 'EMAIL', 'ADDRESS', 'WEBSITE']).optional(),
  label: z.string().max(100).nullable().optional(),
  value: z.string().min(1).max(500).optional(),
  isPrimary: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  metaJson: z.record(z.unknown()).nullable().optional(),
});

export type UpdateBrandContactChannelInput = z.infer<typeof UpdateBrandContactChannelSchema>;

export const UpdateBrandProfileSchema = z.object({
  profileData: BrandProfileDataSchema,
  optimizationScore: z.number().int().min(0).max(100).nullable().optional(),
});

export type UpdateBrandProfileInput = z.infer<typeof UpdateBrandProfileSchema>;

