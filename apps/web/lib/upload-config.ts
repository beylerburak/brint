/**
 * Upload Configuration - Re-exported from shared package
 * 
 * This file provides frontend-specific validation utilities
 * using the shared config from @brint/shared-config.
 */

// Re-export everything from shared package
export {
    // Constants
    MAX_FILE_SIZE_MB,
    MAX_FILE_SIZE_BYTES,
    MAX_AVATAR_SIZE_MB,
    MAX_AVATAR_SIZE_BYTES,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ALLOWED_DOCUMENT_TYPES,
    ALLOWED_FILE_TYPES,
    ALLOWED_EXTENSIONS,
    UPLOAD_CONFIG,

    // Type guards
    isAllowedFileType,
    isImageType,
    isVideoType,
    isDocumentType,
    getFileTypeCategory,
    isFileSizeValid,
    getMaxFileSizeDisplay,
} from '@brint/shared-config/upload'

// Types
export type {
    AllowedImageType,
    AllowedVideoType,
    AllowedDocumentType,
    AllowedFileType,
} from '@brint/shared-config/upload'

/**
 * Validate a file for upload (frontend-specific with File object)
 * Returns null if valid, or an error message if invalid
 */
export function validateFileForUpload(file: File): string | null {
    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`
    }

    // Check file type
    if (!isAllowedFileType(file.type)) {
        const extension = file.name.split('.').pop()?.toLowerCase() || ''
        return `File type ".${extension}" is not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    }

    return null
}

/**
 * Validate multiple files for upload
 * Returns an array of error messages (empty if all valid)
 */
export function validateFilesForUpload(files: File[]): string[] {
    const errors: string[] = []

    for (const file of files) {
        const error = validateFileForUpload(file)
        if (error) {
            errors.push(error)
        }
    }

    return errors
}

// Import for local use
import {
    MAX_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_MB,
    ALLOWED_EXTENSIONS,
    isAllowedFileType,
} from '@brint/shared-config/upload'
