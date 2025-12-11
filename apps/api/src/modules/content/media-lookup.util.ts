/**
 * Media Lookup Utility
 * 
 * Generates media lookup IDs for content that can be used to search for media
 * in Google Drive during publication.
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Generate a media lookup ID for content
 * Format: YYYY-MM-DD {brandHandle} {title} #{random}
 * 
 * @param args - Parameters for generating the lookup ID
 * @returns Generated media lookup ID string
 */
export function generateMediaLookupId(args: {
  date: Date;
  brandHandle: string;
  title: string;
}): string {
  const { date, brandHandle, title } = args;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  const safeTitle = (title || "Untitled").trim();
  const random = Math.floor(10000 + Math.random() * 90000); // 10000–99999

  return `${yyyy}-${mm}-${dd} ${brandHandle} ${safeTitle} #${random}`;
}

/**
 * Get brand handle for media lookup ID generation
 * Priority:
 * 1. Instagram account username (if exists)
 * 2. Brand slug as fallback
 * 
 * @param brandId - Brand ID to get handle for
 * @param prisma - Prisma client instance
 * @returns Brand handle string (e.g., "@beylerinteractive" or "@brand-slug")
 */
export async function getBrandHandleForMediaLookup(
  brandId: string,
  prisma: PrismaClient
): Promise<string> {
  // Try to find Instagram account for this brand
  const instagramAccount = await prisma.socialAccount.findFirst({
    where: {
      brandId,
      platform: 'INSTAGRAM',
      status: 'ACTIVE',
    },
    select: {
      username: true,
    },
    orderBy: {
      createdAt: 'asc', // Use first Instagram account
    },
  });

  if (instagramAccount?.username) {
    // Ensure username starts with @
    const username = instagramAccount.username.startsWith('@')
      ? instagramAccount.username
      : `@${instagramAccount.username}`;
    return username;
  }

  // Fallback to brand slug
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { slug: true },
  });

  return brand ? `@${brand.slug}` : '@unknown';
}
