import type { ContentFormFactor, SocialPlatform } from "@brint/shared-config/platform-rules"

/**
 * Media item used in content creation
 */
export interface ContentMediaItem {
  id: string
  file?: File // Optional for existing media
  preview: string // blob URL or S3 URL
  type: 'image' | 'video' | 'document'
  mediaId?: string // For existing media from API
}

/**
 * Content status types
 */
export type ContentStatusType = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PARTIALLY_PUBLISHED' | 'FAILED' | 'ARCHIVED'

/**
 * Publish mode
 */
export type PublishMode = 'now' | 'setDateTime'

/**
 * Core form state for content creation
 */
export interface ContentCreationFormState {
  formFactor: ContentFormFactor | null
  selectedAccountIds: string[]
  title: string
  caption: string
  tags: string[]
  selectedMedia: ContentMediaItem[]
  publishMode: PublishMode
  selectedDate: Date | undefined
  selectedTime: string
  createAnother: boolean
  isDraft: boolean
  contentStatus: ContentStatusType | null
  mediaLookupId?: string
  useMediaLookupOnPublish: boolean
}

/**
 * Initial state for change tracking
 */
export interface ContentCreationInitialState {
  formFactor: ContentFormFactor | null
  selectedAccountIds: string[]
  title: string
  caption: string
  tags: string[]
  mediaIds: string[]
}

/**
 * Social account data
 */
export interface SocialAccount {
  id: string
  platform: SocialPlatform
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  externalAvatarUrl: string | null
}

/**
 * Tag suggestion from API
 */
export interface TagSuggestion {
  id: string
  name: string
  slug: string
  color: string | null
}

/**
 * Validation flags
 */
export interface ContentValidationFlags {
  isBaseCaptionExceeded: boolean
  isCaptionRequired: boolean
  isCaptionMissing: boolean
  isMediaRequired: boolean
  isMediaMissing: boolean
  hasSelectedAccounts: boolean
  isFeedPost: boolean
}

