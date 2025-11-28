import { prisma } from '../../../lib/prisma.js';
import type { StorageService } from '../../../lib/storage/storage.service.js';
import { logger } from '../../../lib/logger.js';

function extractVariantKeys(variants: unknown): string[] {
  if (!variants || typeof variants !== 'object') return [];
  return Object.values(variants as Record<string, any>)
    .map((variant) => {
      if (variant && typeof variant === 'object' && 'key' in variant) {
        const key = (variant as any).key;
        return typeof key === 'string' ? key : null;
      }
      return null;
    })
    .filter((key): key is string => Boolean(key));
}

export class MediaDeleteService {
  constructor(private storage: StorageService) {}

  async deleteById(mediaId: string, opts?: { workspaceId?: string }) {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) {
      return;
    }

    if (opts?.workspaceId && media.workspaceId !== opts.workspaceId) {
      const err = new Error('MEDIA_WORKSPACE_MISMATCH');
      (err as any).statusCode = 403;
      throw err;
    }

    const keysToDelete = [
      media.objectKey,
      ...extractVariantKeys(media.variants),
    ];

    try {
      await Promise.all(keysToDelete.map((key) => this.storage.deleteObject(key)));
    } catch (error) {
      logger.error({ error, mediaId, keysToDelete }, 'Failed to delete media objects from storage');
      throw error;
    }

    await prisma.media.delete({ where: { id: mediaId } });
  }
}
