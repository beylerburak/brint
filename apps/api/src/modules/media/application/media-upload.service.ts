import { prisma } from '../../../lib/prisma.js';
import type { StorageService } from '../../../lib/storage/storage.service.js';
import { generateImageVariants } from '../lib/image-optimizer.js';
import { logger } from '../../../lib/logger.js';

export type FinalizeUploadInput = {
  objectKey: string;
  workspaceId: string;
  brandId?: string;
  originalName: string;
  contentType?: string;
};

export class MediaUploadService {
  constructor(private storage: StorageService) {}

  async finalizeUpload(input: FinalizeUploadInput) {
    const { objectKey, workspaceId: workspaceIdOrSlug, brandId, originalName } = input;

    // 0) Workspace ID'yi bul (slug ise lookup yap)
    let workspaceId: string;
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { id: workspaceIdOrSlug },
          { slug: workspaceIdOrSlug },
        ],
      },
      select: { id: true },
    });
    if (!workspace) {
      logger.error({ workspaceIdOrSlug }, 'Workspace not found when finalizing media upload (tried both ID and slug)');
      const err = new Error('WORKSPACE_NOT_FOUND');
      throw err;
    }
    workspaceId = workspace.id;

    // 1) Original dosyayı S3'ten çek
    let original;
    try {
      logger.info({ objectKey, workspaceId }, 'Attempting to fetch original file from S3 for finalize');
      original = await this.storage.getObjectBuffer(objectKey);
      logger.info({ objectKey, size: original.buffer.byteLength, contentType: original.contentType }, 'Successfully fetched original file from S3');
    } catch (error: any) {
      if (error?.message === 'OBJECT_NOT_FOUND') {
        logger.error({ 
          objectKey, 
          workspaceId, 
          error: error.cause,
          message: 'File not found in S3. This may indicate: 1) PUT request failed (CORS/bucket policy issue), 2) Wrong objectKey, 3) Upload not completed'
        }, 'MEDIA_OBJECT_NOT_FOUND: File not found in S3 during finalize');
        const err = new Error('MEDIA_OBJECT_NOT_FOUND');
        (err as any).cause = error;
        throw err;
      }
      logger.error({ error, objectKey, workspaceId }, 'Unexpected error fetching file from S3');
      throw error;
    }
    const contentType = original.contentType ?? input.contentType ?? 'application/octet-stream';
    const sizeBytes = original.contentLength ?? original.buffer.byteLength;

    // 2) Image ise variant üret
    const { variants, files } = await generateImageVariants({
      buffer: original.buffer,
      contentType,
      baseKey: objectKey,
    });

    // 3) Variant'ları S3'e yükle
    await Promise.all(
      files.map((file) =>
        this.storage.putObject(file.key, file.buffer, file.contentType)
      )
    );

    // 4) Brand varsa kontrol et
    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, workspaceId: true },
      });
      if (!brand) {
        logger.error({ brandId, workspaceId }, 'Brand not found when finalizing media upload');
        const err = new Error('BRAND_NOT_FOUND');
        throw err;
      }
      if (brand.workspaceId !== workspaceId) {
        logger.error({ brandId, workspaceId, brandWorkspaceId: brand.workspaceId }, 'Brand does not belong to workspace');
        const err = new Error('BRAND_WORKSPACE_MISMATCH');
        throw err;
      }
    }

    // 5) DB'ye media kaydı oluştur
    let media;
    try {
      media = await prisma.media.create({
        data: {
          workspaceId,
          brandId: brandId ?? null,
          objectKey,
          originalName,
          contentType,
          sizeBytes,
          variants,
          isPublic: false,
        },
      });
    } catch (error: any) {
      logger.error({ 
        error, 
        objectKey, 
        workspaceId, 
        brandId,
        prismaCode: error?.code,
        prismaMeta: error?.meta 
      }, 'Failed to create media record in database');
      
      // Prisma foreign key constraint errors
      if (error?.code === 'P2003') {
        const err = new Error('FOREIGN_KEY_CONSTRAINT_VIOLATION');
        (err as any).details = error.meta;
        throw err;
      }
      
      // Prisma unique constraint errors (objectKey already exists)
      if (error?.code === 'P2002') {
        const err = new Error('MEDIA_OBJECT_KEY_ALREADY_EXISTS');
        (err as any).details = error.meta;
        throw err;
      }
      
      throw error;
    }

    return { media, variants };
  }
}
