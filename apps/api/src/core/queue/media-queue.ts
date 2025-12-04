/**
 * Media Processing Queue
 * 
 * BullMQ-based queue for asynchronous media processing tasks.
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../../lib/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis connection for BullMQ
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
});

// Job data types
export type GenerateVariantsJobData = {
  mediaId: string;
  workspaceId: string;
  kind: 'IMAGE' | 'VIDEO';
  originalKey: string;
  bucket: string;
};

// Queue instance
export const mediaQueue = new Queue<GenerateVariantsJobData>('media-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Add a job to generate variants for uploaded media
 */
export async function enqueueVariantGeneration(data: GenerateVariantsJobData) {
  const job = await mediaQueue.add('generate-variants', data, {
    jobId: `variants-${data.mediaId}`,
  });

  logger.info(
    {
      jobId: job.id,
      mediaId: data.mediaId,
      kind: data.kind,
    },
    'Enqueued variant generation job'
  );

  return job;
}

/**
 * Get queue status and metrics
 */
export async function getQueueStatus() {
  const [waiting, active, completed, failed] = await Promise.all([
    mediaQueue.getWaitingCount(),
    mediaQueue.getActiveCount(),
    mediaQueue.getCompletedCount(),
    mediaQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down media queue...');
  await mediaQueue.close();
  await connection.quit();
});

