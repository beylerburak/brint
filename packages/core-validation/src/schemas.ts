import { z } from 'zod';
import { buildStringSchema, emailSchema } from './helpers.js';
import { fieldRules } from './rules.js';

export const usernameSchema = buildStringSchema(fieldRules.username, 'validation.username');
export const slugSchema = buildStringSchema(fieldRules.slug, 'validation.slug');
export const workspaceSlugSchema = buildStringSchema(fieldRules.workspaceSlug, 'validation.workspaceSlug');
export const displayNameSchema = buildStringSchema(fieldRules.displayName, 'validation.displayName');

export const identifierSchema = buildStringSchema(fieldRules.identifier, 'validation.identifier');

/**
 * UUID validation schema for workspace IDs
 */
export const workspaceIdSchema = z.string().uuid('validation.workspaceId.invalid');

/**
 * UUID validation schema for brand IDs
 */
export const brandIdSchema = z.string().uuid('validation.brandId.invalid');

export const userCreateSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema,
  name: displayNameSchema.optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const workspaceCreateSchema = z.object({
  name: displayNameSchema,
  slug: workspaceSlugSchema,
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional().default('FREE'),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;

export const workspaceInviteCreateSchema = z.object({
  email: emailSchema,
  expiresAt: z.string().datetime().optional().nullable(),
});

export type WorkspaceInviteCreateInput = z.infer<typeof workspaceInviteCreateSchema>;

/**
 * Magic link request schema
 * Used for POST /auth/magic-link endpoint
 */
export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url().optional(),
});

export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;

/**
 * Create workspace invite schema
 * Used for POST /workspaces/:workspaceId/invites endpoint
 */
export const createWorkspaceInviteSchema = z.object({
  email: emailSchema,
  roleKey: z.string().min(1, 'validation.roleKey.required'),
});

export type CreateWorkspaceInviteInput = z.infer<typeof createWorkspaceInviteSchema>;

/**
 * Cursor-based pagination query schema
 * Used for validating pagination query parameters in API routes
 * 
 * @example
 * ```typescript
 * const parsed = cursorPaginationQuerySchema.safeParse(request.query);
 * if (!parsed.success) {
 *   throw new BadRequestError('INVALID_QUERY', 'Invalid pagination parameters');
 * }
 * const { limit, cursor } = parsed.data;
 * ```
 */
export const cursorPaginationQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const num = typeof value === 'string' ? parseInt(value, 10) : value;
      return isNaN(num) ? undefined : num;
    })
    .pipe(z.number().int().min(1).max(100).optional()),
  cursor: z.string().optional(),
});

export type CursorPaginationQueryInput = z.infer<typeof cursorPaginationQuerySchema>;

// ======================
// Brand Validation Schemas
// ======================

/**
 * CUID validation schema
 * Used for validating entity IDs that use cuid format
 */
export const cuidSchema = z.string().min(1, 'validation.cuid.required');

/**
 * Create brand schema
 * Used for POST /v1/brands endpoint
 * 
 * Note: slug is optional - if not provided, backend will generate from name
 */
export const createBrandSchema = z.object({
  name: z.string().min(1, 'validation.brand.name.required').max(255, 'validation.brand.name.max'),
  slug: z.string().min(1, 'validation.brand.slug.required').max(255, 'validation.brand.slug.max')
    .regex(/^[a-z0-9-]+$/, 'validation.brand.slug.pattern').optional(),
  description: z.string().max(2000, 'validation.brand.description.max').optional().nullable(),
  industry: z.string().max(255, 'validation.brand.industry.max').optional().nullable(),
  language: z.string().max(10, 'validation.brand.language.max').optional().nullable(),
  timezone: z.string().max(100, 'validation.brand.timezone.max').optional().nullable(),
  toneOfVoice: z.string().max(500, 'validation.brand.toneOfVoice.max').optional().nullable(),
  primaryColor: z.string().max(20, 'validation.brand.primaryColor.max')
    .regex(/^#[0-9A-Fa-f]{6}$/, 'validation.brand.primaryColor.pattern').optional().nullable(),
  secondaryColor: z.string().max(20, 'validation.brand.secondaryColor.max')
    .regex(/^#[0-9A-Fa-f]{6}$/, 'validation.brand.secondaryColor.pattern').optional().nullable(),
  websiteUrl: z.string().url('validation.brand.websiteUrl.invalid').max(2000, 'validation.brand.websiteUrl.max').optional().nullable(),
  logoMediaId: z.string().max(50, 'validation.brand.logoMediaId.max').optional().nullable(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

/**
 * Update brand schema (partial)
 * Used for PATCH /v1/brands/:brandId endpoint
 */
export const updateBrandSchema = createBrandSchema.partial();

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

/**
 * Update brand readiness schema
 * Used for updating wizard/progress fields
 */
export const updateBrandReadinessSchema = z.object({
  profileCompleted: z.boolean().optional(),
  publishingDefaultsConfigured: z.boolean().optional(),
});

export type UpdateBrandReadinessInput = z.infer<typeof updateBrandReadinessSchema>;

/**
 * Brand params schema
 * Used for validating route parameters like :brandId
 */
export const brandParamsSchema = z.object({
  brandId: cuidSchema,
});

export type BrandParamsInput = z.infer<typeof brandParamsSchema>;

/**
 * Brand list query schema
 * Extends cursor pagination with brand-specific filters
 */
export const brandListQuerySchema = cursorPaginationQuerySchema.extend({
  includeArchived: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().optional().default(false)
  ),
});

export type BrandListQueryInput = z.infer<typeof brandListQuerySchema>;

// ======================
// Brand Hashtag Preset Schemas
// ======================

/**
 * Create brand hashtag preset schema
 * Used for POST /v1/brands/:brandId/hashtag-presets endpoint
 */
export const createBrandHashtagPresetSchema = z.object({
  name: z.string().min(1, 'validation.hashtagPreset.name.required').max(255, 'validation.hashtagPreset.name.max'),
  tags: z.array(z.string().min(1, 'validation.hashtagPreset.tag.required'))
    .min(1, 'validation.hashtagPreset.tags.required')
    .max(100, 'validation.hashtagPreset.tags.max'),
});

export type CreateBrandHashtagPresetInput = z.infer<typeof createBrandHashtagPresetSchema>;

/**
 * Update brand hashtag preset schema (partial)
 * Used for PATCH /v1/brands/:brandId/hashtag-presets/:presetId endpoint
 */
export const updateBrandHashtagPresetSchema = createBrandHashtagPresetSchema.partial();

export type UpdateBrandHashtagPresetInput = z.infer<typeof updateBrandHashtagPresetSchema>;

/**
 * Hashtag preset params schema
 * Used for validating route parameters like :brandId and :presetId
 */
export const hashtagPresetParamsSchema = z.object({
  brandId: cuidSchema,
  presetId: cuidSchema,
});

// ======================
// Social Account Validation Schemas
// ======================

/**
 * Social platform enum schema
 * Matches Prisma SocialPlatform enum
 */
export const socialPlatformSchema = z.enum([
  "FACEBOOK_PAGE",
  "INSTAGRAM_BUSINESS",
  "INSTAGRAM_BASIC",
  "YOUTUBE_CHANNEL",
  "TIKTOK_BUSINESS",
  "PINTEREST_PROFILE",
  "X_ACCOUNT",
  "LINKEDIN_PAGE",
]);

export type SocialPlatformInput = z.infer<typeof socialPlatformSchema>;

/**
 * Social account status enum schema
 */
export const socialAccountStatusSchema = z.enum([
  "ACTIVE",
  "DISCONNECTED",
  "REMOVED",
]);

export type SocialAccountStatusInput = z.infer<typeof socialAccountStatusSchema>;

/**
 * Social account ID schema
 */
export const socialAccountIdSchema = cuidSchema;

/**
 * Connect social account body schema
 * Used for POST /v1/brands/:brandId/social-accounts
 */
export const connectSocialAccountSchema = z.object({
  platform: socialPlatformSchema,
  externalId: z.string().min(1, 'validation.socialAccount.externalId.required').max(500, 'validation.socialAccount.externalId.max'),
  username: z.string().min(1).max(255).optional(),
  displayName: z.string().min(1).max(255).optional(),
  profileUrl: z.string().url('validation.socialAccount.profileUrl.invalid').optional(),
  platformData: z.record(z.any()).optional(),
  // Credentials are flexible - service will validate/cast as needed
  credentials: z.object({
    platform: socialPlatformSchema,
    data: z.record(z.any()),
  }),
});

export type ConnectSocialAccountInput = z.infer<typeof connectSocialAccountSchema>;

/**
 * Social account params schema
 * Used for validating route parameters like :brandId and :socialAccountId
 */
export const socialAccountParamsSchema = z.object({
  brandId: cuidSchema,
  socialAccountId: cuidSchema,
});

export type SocialAccountParamsInput = z.infer<typeof socialAccountParamsSchema>;

/**
 * Social account list query schema
 * Extends cursor pagination with status filter
 * - status: filter by specific status
 * - includeRemoved: when true, includes REMOVED accounts (default: false, hides REMOVED)
 */
export const socialAccountListQuerySchema = cursorPaginationQuerySchema.extend({
  status: socialAccountStatusSchema.optional(),
  includeRemoved: z.boolean().optional(),
});

// ======================
// Publication Validation Schemas
// ======================

/**
 * Media ID schema - references our internal Media table
 */
export const mediaIdSchema = z.string().min(1, 'validation.mediaId.required');

/**
 * ISO datetime string schema
 */
export const isoDateTimeSchema = z.string().datetime('validation.dateTime.invalid');

// --------------------
// Instagram Publication Schemas
// --------------------

/**
 * Instagram content type enum
 */
export const instagramContentTypeEnum = z.enum(['IMAGE', 'CAROUSEL', 'REEL', 'STORY']);

export type InstagramContentType = z.infer<typeof instagramContentTypeEnum>;

/**
 * Instagram user tag schema (for tagging users in posts)
 */
const instagramUserTagSchema = z.object({
  igUserId: z.string().min(1, 'validation.instagram.userTag.igUserId.required'),
  x: z.number().min(0).max(1, 'validation.instagram.userTag.x.range'),
  y: z.number().min(0).max(1, 'validation.instagram.userTag.y.range'),
});

/**
 * Instagram payload base - common fields for all IG content types
 */
const instagramPayloadBase = z.object({
  contentType: instagramContentTypeEnum,
  caption: z.string().max(2200, 'validation.instagram.caption.max').optional(),
  disableComments: z.boolean().optional(),
  disableLikes: z.boolean().optional(),
});

/**
 * Instagram IMAGE payload
 */
const instagramImagePayload = instagramPayloadBase.extend({
  contentType: z.literal('IMAGE'),
  imageMediaId: mediaIdSchema,
  altText: z.string().max(1000, 'validation.instagram.altText.max').optional(),
  locationId: z.string().optional(),
  userTags: z.array(instagramUserTagSchema).optional(),
});

/**
 * Instagram CAROUSEL item schema
 */
const instagramCarouselItemSchema = z.object({
  mediaId: mediaIdSchema,
  type: z.enum(['IMAGE', 'VIDEO']),
  altText: z.string().max(1000, 'validation.instagram.altText.max').optional(),
});

/**
 * Instagram CAROUSEL payload
 */
const instagramCarouselPayload = instagramPayloadBase.extend({
  contentType: z.literal('CAROUSEL'),
  items: z.array(instagramCarouselItemSchema)
    .min(2, 'validation.instagram.carousel.items.min')
    .max(10, 'validation.instagram.carousel.items.max'),
  locationId: z.string().optional(),
});

/**
 * Instagram REEL payload
 */
const instagramReelPayload = instagramPayloadBase.extend({
  contentType: z.literal('REEL'),
  videoMediaId: mediaIdSchema,
  coverMediaId: mediaIdSchema.optional(),
  shareToFeed: z.boolean().default(true),
  thumbOffsetSeconds: z.number().int().min(0).max(60).optional(),
  audioRename: z.string().max(255).optional(),
});

/**
 * Instagram STORY payload
 * Stories can be image or video, disappear after 24 hours
 * Graph API: POST /{ig-user-id}/media with media_type=STORIES
 */
const instagramStoryPayload = z.object({
  contentType: z.literal('STORY'),
  storyType: z.enum(['IMAGE', 'VIDEO']),
  imageMediaId: mediaIdSchema.optional(),
  videoMediaId: mediaIdSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.storyType === 'IMAGE' && !data.imageMediaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.instagram.story.imageMediaIdRequired',
      path: ['imageMediaId'],
    });
  }
  if (data.storyType === 'VIDEO' && !data.videoMediaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.instagram.story.videoMediaIdRequired',
      path: ['videoMediaId'],
    });
  }
});

/**
 * Instagram publication payload - union of all content types
 * Note: Using regular union because STORY needs custom validation
 */
export const instagramPublicationPayloadSchema = z.union([
  instagramImagePayload,
  instagramCarouselPayload,
  instagramReelPayload,
  instagramStoryPayload,
]);

export type InstagramPublicationPayload = z.infer<typeof instagramPublicationPayloadSchema>;

// --------------------
// Facebook Publication Schemas
// --------------------

/**
 * Facebook content type enum
 */
export const facebookContentTypeEnum = z.enum(['PHOTO', 'CAROUSEL', 'VIDEO', 'LINK', 'STORY']);

export type FacebookContentType = z.infer<typeof facebookContentTypeEnum>;

/**
 * Facebook payload base - common fields for all FB content types
 */
const facebookPayloadBase = z.object({
  contentType: facebookContentTypeEnum,
  message: z.string().max(63206, 'validation.facebook.message.max').optional(),
});

/**
 * Facebook PHOTO payload
 */
const facebookPhotoPayload = facebookPayloadBase.extend({
  contentType: z.literal('PHOTO'),
  imageMediaId: mediaIdSchema,
  altText: z.string().max(1000, 'validation.facebook.altText.max').optional(),
});

/**
 * Facebook CAROUSEL item schema
 */
const facebookCarouselItemSchema = z.object({
  mediaId: mediaIdSchema,
  type: z.enum(['IMAGE', 'VIDEO']),
  altText: z.string().max(1000, 'validation.facebook.altText.max').optional(),
});

/**
 * Facebook CAROUSEL payload
 */
const facebookCarouselPayload = facebookPayloadBase.extend({
  contentType: z.literal('CAROUSEL'),
  items: z.array(facebookCarouselItemSchema)
    .min(2, 'validation.facebook.carousel.items.min')
    .max(10, 'validation.facebook.carousel.items.max'),
});

/**
 * Facebook VIDEO payload
 */
const facebookVideoPayload = facebookPayloadBase.extend({
  contentType: z.literal('VIDEO'),
  videoMediaId: mediaIdSchema,
  title: z.string().max(255, 'validation.facebook.video.title.max').optional(),
  thumbMediaId: mediaIdSchema.optional(),
});

/**
 * Facebook LINK payload
 */
const facebookLinkPayload = facebookPayloadBase.extend({
  contentType: z.literal('LINK'),
  linkUrl: z.string().url('validation.facebook.link.url.invalid'),
});

/**
 * Facebook STORY payload
 * Facebook Page Stories - image or video
 * Graph API: POST /{page-id}/photo_stories or /{page-id}/video_stories
 */
const facebookStoryPayload = z.object({
  contentType: z.literal('STORY'),
  storyType: z.enum(['IMAGE', 'VIDEO']),
  imageMediaId: mediaIdSchema.optional(),
  videoMediaId: mediaIdSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.storyType === 'IMAGE' && !data.imageMediaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.facebook.story.imageMediaIdRequired',
      path: ['imageMediaId'],
    });
  }
  if (data.storyType === 'VIDEO' && !data.videoMediaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.facebook.story.videoMediaIdRequired',
      path: ['videoMediaId'],
    });
  }
});

/**
 * Facebook publication payload - union of all content types
 * Note: Using regular union because STORY needs custom validation
 */
export const facebookPublicationPayloadSchema = z.union([
  facebookPhotoPayload,
  facebookCarouselPayload,
  facebookVideoPayload,
  facebookLinkPayload,
  facebookStoryPayload,
]);

export type FacebookPublicationPayload = z.infer<typeof facebookPublicationPayloadSchema>;

// --------------------
// Create Publication Request Schemas
// --------------------

/**
 * Create Instagram publication request body schema
 * Used for POST /v1/brands/:brandId/publications/instagram
 */
export const createInstagramPublicationSchema = z.object({
  socialAccountId: cuidSchema,
  publishAt: isoDateTimeSchema.optional(),
  clientRequestId: z.string().max(64).optional(),
  payload: instagramPublicationPayloadSchema,
});

export type CreateInstagramPublicationInput = z.infer<typeof createInstagramPublicationSchema>;

/**
 * Create Facebook publication request body schema
 * Used for POST /v1/brands/:brandId/publications/facebook
 */
export const createFacebookPublicationSchema = z.object({
  socialAccountId: cuidSchema,
  publishAt: isoDateTimeSchema.optional(),
  clientRequestId: z.string().max(64).optional(),
  payload: facebookPublicationPayloadSchema,
});

export type CreateFacebookPublicationInput = z.infer<typeof createFacebookPublicationSchema>;

/**
 * Publication params schema
 * Used for validating route parameters like :brandId and :publicationId
 */
export const publicationParamsSchema = z.object({
  brandId: cuidSchema,
  publicationId: cuidSchema.optional(),
});

export type PublicationParamsInput = z.infer<typeof publicationParamsSchema>;
