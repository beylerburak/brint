/**
 * Slugify Utility
 * 
 * Converts strings to URL-friendly slugs with Turkish character support.
 */

/**
 * Turkish character map
 */
const TR_CHAR_MAP: Record<string, string> = {
  'ç': 'c',
  'Ç': 'c',
  'ğ': 'g',
  'Ğ': 'g',
  'ı': 'i',
  'İ': 'i',
  'ö': 'o',
  'Ö': 'o',
  'ş': 's',
  'Ş': 's',
  'ü': 'u',
  'Ü': 'u',
};

/**
 * Converts a string to a URL-friendly slug
 * 
 * Features:
 * - Converts Turkish characters to ASCII equivalents
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Removes leading/trailing hyphens
 * 
 * @param text - Text to slugify
 * @returns URL-friendly slug
 * 
 * @example
 * slugify("Türkçe Marka Adı") // "turkce-marka-adi"
 * slugify("Hello World!") // "hello-world"
 * slugify("Test  --  Brand") // "test-brand"
 */
export function slugify(text: string): string {
  let slug = text.toLowerCase();
  
  // Replace Turkish characters
  for (const [turkishChar, asciiChar] of Object.entries(TR_CHAR_MAP)) {
    slug = slug.replace(new RegExp(turkishChar, 'g'), asciiChar);
  }
  
  // Replace non-alphanumeric characters with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  
  // Remove consecutive hyphens
  slug = slug.replace(/-+/g, '-');
  
  // Remove leading/trailing hyphens
  slug = slug.replace(/^-|-$/g, '');
  
  return slug;
}

/**
 * Generates a unique slug by appending a random suffix
 * 
 * Useful when a base slug is already taken.
 * 
 * @param baseSlug - Base slug to append suffix to
 * @param suffixLength - Length of random suffix (default: 4)
 * @returns Slug with random suffix
 * 
 * @example
 * generateUniqueSlug("my-brand") // "my-brand-x7k9"
 * generateUniqueSlug("test", 6) // "test-ab3f9k"
 */
export function generateUniqueSlug(baseSlug: string, suffixLength: number = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  
  for (let i = 0; i < suffixLength; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `${baseSlug}-${suffix}`;
}

/**
 * Generates a slug from text, with optional uniqueness suffix
 * 
 * @param text - Text to convert to slug
 * @param options - Options
 * @param options.appendSuffix - If true, appends a random suffix
 * @param options.suffixLength - Length of random suffix (default: 4)
 * @returns Generated slug
 * 
 * @example
 * generateSlug("My Brand") // "my-brand"
 * generateSlug("My Brand", { appendSuffix: true }) // "my-brand-x7k9"
 */
export function generateSlug(
  text: string, 
  options?: { appendSuffix?: boolean; suffixLength?: number }
): string {
  const baseSlug = slugify(text);
  
  if (options?.appendSuffix) {
    return generateUniqueSlug(baseSlug, options.suffixLength);
  }
  
  return baseSlug;
}

