import { Queue, Worker, QueueOptions, WorkerOptions } from "bullmq";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import IORedis from "ioredis";
import { captureException, isSentryInitialized } from "../observability/sentry.js";

/**
 * BullMQ connection configuration
 * BullMQ requires maxRetriesPerRequest: null
 * We create a separate Redis connection for BullMQ to avoid conflicts
 */
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * Create a BullMQ queue instance
 * @param name Queue name
 * @param options Optional queue options
 */
export function createQueue<T = any>(name: string, options?: QueueOptions) {
  return new Queue<T>(name, {
    connection,
    ...options,
  });
}

/**
 * Create a BullMQ worker instance
 * @param name Queue name to process
 * @param processor Job processor function
 * @param options Optional worker options
 */
export function createWorker<T = any>(
  name: string,
  processor: (job: import("bullmq").Job<T>) => Promise<void>,
  options?: WorkerOptions
) {
  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency: 5,
    ...options,
  });

  // Log worker events
  worker.on("completed", (job) => {
    logger.debug(
      {
        queue: name,
        jobId: job.id,
        jobName: job.name,
      },
      "Job completed"
    );
  });

  worker.on("failed", (job, err) => {
    // Check if this is a retryable error
    const isRetryable = (err as any).isRetryable === true;
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 3;
    const isMaxAttemptsReached = attemptsMade >= maxAttempts;
    
    // Log level depends on whether it's retryable and if max attempts reached
    if (isRetryable && !isMaxAttemptsReached) {
      // Retryable error with attempts remaining - log as warning, don't send to Sentry
      logger.warn(
        {
          queue: name,
          jobId: job?.id,
          jobName: job?.name,
          error: err.message,
          attemptsMade,
          maxAttempts,
          willRetry: true,
        },
        "Job failed (retryable, will retry)"
      );
      return;
    }
    
    // Non-retryable error or max attempts reached - log as error and send to Sentry
    logger.error(
      {
        queue: name,
        jobId: job?.id,
        jobName: job?.name,
        error: err.message,
        stack: err.stack,
        attemptsMade,
        maxAttempts,
        isRetryable,
      },
      "Job failed"
    );

    // Send to Sentry only for non-retryable errors or after max attempts
    if (isSentryInitialized()) {
      captureException(err, {
        queue: name,
        jobId: job?.id?.toString(),
        jobName: job?.name,
        attemptsMade,
        maxAttempts,
        isRetryable,
      });
    }
  });

  worker.on("error", (err) => {
    logger.error(
      {
        queue: name,
        error: err.message,
        stack: err.stack,
      },
      "Worker error"
    );

    // Send to Sentry if initialized
    if (isSentryInitialized()) {
      captureException(err, {
        queue: name,
        errorType: "worker_error",
      });
    }
  });

  logger.info({ queue: name }, "Worker started");

  return worker;
}

