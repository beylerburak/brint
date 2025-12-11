/**
 * BullMQ Client
 *
 * Shared BullMQ infrastructure for queues and workers.
 * Provides Redis connection and reusable helpers.
 */

import { Queue, Worker, JobsOptions, QueueOptions, WorkerOptions } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD ?? undefined,
};

/**
 * Create a new BullMQ queue
 */
export function createQueue(name: string, options?: Omit<QueueOptions, "connection">) {
  return new Queue(name, {
    connection,
    ...options,
  });
}


/**
 * Create a BullMQ worker
 */
export function createWorker(
  name: string,
  processor: (job: any) => Promise<void>,
  options?: Omit<WorkerOptions, "connection">
) {
  return new Worker(name, processor, {
    connection,
    ...options,
  });
}

/**
 * Default job options for publication jobs
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 30_000, // 30 seconds
  },
  removeOnComplete: 100,
  removeOnFail: 100,
};