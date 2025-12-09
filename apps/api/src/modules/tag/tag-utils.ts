/**
 * Tag Utilities
 * 
 * Helper functions for tag normalization and processing.
 */

/**
 * Normalizes a tag name into a URL-friendly slug.
 * 
 * Examples:
 * - "Black Friday 2025!" → "black-friday-2025"
 * - "Ürün X Launch" → "urun-x-launch"
 * - "   Multiple   Spaces   " → "multiple-spaces"
 * 
 * @param name - The tag name to normalize
 * @returns Normalized slug string
 */
export function normalizeTagSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    // Replace Turkish characters
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/İ/g, 'i')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    // Replace spaces and special characters with hyphens
    .replace(/\s+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9\-]/g, '')
    // Replace multiple consecutive hyphens with a single hyphen
    .replace(/\-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^\-+|\-+$/g, '');
}

/**
 * Validates and normalizes an array of tag names.
 * 
 * - Trims whitespace
 * - Filters out empty strings
 * - Removes duplicates
 * - Normalizes slugs
 * 
 * @param tagNames - Array of tag names to process
 * @returns Array of normalized tag objects with name and slug
 */
export function normalizeTagNames(tagNames: string[]): Array<{ name: string; slug: string }> {
  const normalized = tagNames
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => ({
      name,
      slug: normalizeTagSlug(name),
    }))
    .filter(item => item.slug.length > 0); // Filter out tags that become empty after normalization

  // Remove duplicates by slug
  const seen = new Set<string>();
  return normalized.filter(item => {
    if (seen.has(item.slug)) {
      return false;
    }
    seen.add(item.slug);
    return true;
  });
}
