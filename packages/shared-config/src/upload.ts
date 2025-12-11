/**
 * Upload Configuration
 * 
 * Shared file upload rules used by both frontend validation
 * and backend processing. Single source of truth.
 */

// Size limits
export const MAX_FILE_SIZE_MB = 400
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export const MAX_AVATAR_SIZE_MB = 3
export const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
] as const

export const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
] as const

export const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

// Combined list of all allowed types
export const ALLOWED_FILE_TYPES = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_VIDEO_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
] as const

// Human-readable extensions for error messages
export const ALLOWED_EXTENSIONS = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    // Videos
    '.mp4', '.webm', '.ogg', '.mov',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
] as const

// Type definitions
export type AllowedImageType = typeof ALLOWED_IMAGE_TYPES[number]
export type AllowedVideoType = typeof ALLOWED_VIDEO_TYPES[number]
export type AllowedDocumentType = typeof ALLOWED_DOCUMENT_TYPES[number]
export type AllowedFileType = typeof ALLOWED_FILE_TYPES[number]

/**
 * Check if a MIME type is allowed for upload
 */
export function isAllowedFileType(mimeType: string): mimeType is AllowedFileType {
    return (ALLOWED_FILE_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Check if a MIME type is an image
 */
export function isImageType(mimeType: string): mimeType is AllowedImageType {
    return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Check if a MIME type is a video
 */
export function isVideoType(mimeType: string): mimeType is AllowedVideoType {
    return (ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Check if a MIME type is a document
 */
export function isDocumentType(mimeType: string): mimeType is AllowedDocumentType {
    return (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Get file type category
 */
export function getFileTypeCategory(mimeType: string): 'image' | 'video' | 'document' | 'unknown' {
    if (isImageType(mimeType)) return 'image'
    if (isVideoType(mimeType)) return 'video'
    if (isDocumentType(mimeType)) return 'document'
    return 'unknown'
}

/**
 * Validate file size
 */
export function isFileSizeValid(sizeBytes: number, isAvatar = false): boolean {
    const maxSize = isAvatar ? MAX_AVATAR_SIZE_BYTES : MAX_FILE_SIZE_BYTES
    return sizeBytes <= maxSize
}

/**
 * Get human-readable max file size
 */
export function getMaxFileSizeDisplay(isAvatar = false): string {
    return isAvatar ? `${MAX_AVATAR_SIZE_MB}MB` : `${MAX_FILE_SIZE_MB}MB`
}

/**
 * Upload config object (for backward compatibility)
 */
export const UPLOAD_CONFIG = {
    maxFileSizeMB: MAX_FILE_SIZE_MB,
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    maxAvatarSizeMB: MAX_AVATAR_SIZE_MB,
    maxAvatarSizeBytes: MAX_AVATAR_SIZE_BYTES,
    allowedImageTypes: ALLOWED_IMAGE_TYPES,
    allowedVideoTypes: ALLOWED_VIDEO_TYPES,
    allowedDocumentTypes: ALLOWED_DOCUMENT_TYPES,
} as const
