/**
 * Media Processing Worker
 * 
 * BullMQ worker that processes media files and generates variants.
 */

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import sharp from 'sharp';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../../lib/prisma.js';
import { uploadToS3, getMediaObjectKey, getS3Client, MEDIA_BUCKET_NAME } from '../storage/s3-client.js';
import { logger } from '../../lib/logger.js';
import type { GenerateVariantsJobData } from './media-queue.js';
import { Readable } from 'stream';
import { APP_CONFIG } from '../../config/app-config.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Image variant configurations from app config
const IMAGE_VARIANTS = APP_CONFIG.media.variants.image;

/**
 * Download file from S3
 */
async function downloadFromS3(bucket: string, key: string): Promise<Buffer> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  const stream = response.Body as Readable;

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Generate image variants using Sharp
 */
async function generateImageVariants(data: GenerateVariantsJobData) {
  logger.info({ mediaId: data.mediaId }, 'Starting image variant generation');

  // Download original from S3
  const originalBuffer = await downloadFromS3(data.bucket, data.originalKey);

  // Get image metadata
  const metadata = await sharp(originalBuffer).metadata();

  // Update media with width/height
  await prisma.media.update({
    where: { id: data.mediaId },
    data: {
      width: metadata.width,
      height: metadata.height,
      status: 'PROCESSING',
    },
  });

  const variants: Record<string, any> = {};

  // Generate each variant
  for (const [variantName, config] of Object.entries(IMAGE_VARIANTS)) {
    try {
      const processedBuffer = await sharp(originalBuffer)
        .resize(config.width, config.height, { fit: config.fit })
        .webp({ quality: APP_CONFIG.media.variants.quality.webp })
        .toBuffer();

      const variantKey = getMediaObjectKey(
        data.workspaceId,
        data.mediaId,
        variantName,
        'webp'
      );

      await uploadToS3({
        key: variantKey,
        body: processedBuffer,
        contentType: 'image/webp',
      });

      const variantMetadata = await sharp(processedBuffer).metadata();

      variants[variantName] = {
        key: variantKey,
        width: variantMetadata.width,
        height: variantMetadata.height,
        sizeBytes: processedBuffer.length,
        format: 'webp',
      };

      logger.info({ mediaId: data.mediaId, variant: variantName }, 'Image variant generated');
    } catch (error) {
      logger.error({ error, mediaId: data.mediaId, variant: variantName }, 'Failed to generate image variant');
    }
  }

  // Update media record with variants
  await prisma.media.update({
    where: { id: data.mediaId },
    data: {
      status: 'READY',
      variants,
    },
  });

  logger.info({ mediaId: data.mediaId, variantCount: Object.keys(variants).length }, 'Image variants completed');
}

/**
 * Generate video variants using FFmpeg
 * (Placeholder - FFmpeg implementation would go here)
 */
async function generateVideoVariants(data: GenerateVariantsJobData) {
  logger.info({ mediaId: data.mediaId }, 'Video variant generation placeholder');

  // TODO: Implement video variant generation with fluent-ffmpeg
  // For now, just mark as READY
  await prisma.media.update({
    where: { id: data.mediaId },
    data: {
      status: 'READY',
      variants: {
        note: 'Video variant generation not yet implemented',
      },
    },
  });
}

/**
 * Process variant generation job
 */
async function processVariantGeneration(job: any) {
  const data: GenerateVariantsJobData = job.data;

  logger.info({ jobId: job.id, mediaId: data.mediaId, kind: data.kind }, 'Processing variant generation job');

  try {
    if (data.kind === 'IMAGE') {
      await generateImageVariants(data);
    } else if (data.kind === 'VIDEO') {
      await generateVideoVariants(data);
    }

    logger.info({ jobId: job.id, mediaId: data.mediaId }, 'Variant generation completed');
  } catch (error) {
    logger.error({ error, jobId: job.id, mediaId: data.mediaId }, 'Variant generation failed');

    // Update media status to FAILED
    await prisma.media.update({
      where: { id: data.mediaId },
      data: { status: 'FAILED' },
    });

    throw error; // Re-throw so BullMQ marks job as failed
  }
}

/**
 * Create and start the media processing worker
 */
export function createMediaWorker() {
  const worker = new Worker('media-processing', processVariantGeneration, {
    connection,
    concurrency: 2, // Process 2 jobs at a time
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Media processing job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Media processing job failed');
  });

  logger.info('Media processing worker started');

  return worker;
}

