import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

let isInitialized = false;

/**
 * Initialize Sentry for error tracking and performance monitoring
 * Only initializes if SENTRY_DSN_API is provided
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN_API || env.SENTRY_DSN_API.trim() === "") {
    logger.debug("Sentry not initialized: SENTRY_DSN_API not provided");
    return;
  }

  try {
    Sentry.init({
      dsn: env.SENTRY_DSN_API,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
      integrations: [
        nodeProfilingIntegration(),
      ],
      // Setting this option to true will send default PII data to Sentry
      sendDefaultPii: true,
      // Capture unhandled promise rejections
      captureUnhandledRejections: true,
      // Capture uncaught exceptions
      beforeSend(event, hint) {
        // In development, log to console for debugging
        if (env.NODE_ENV === "development") {
          logger.debug({ event, hint }, "Sentry event captured");
        }
        return event;
      },
    });

    isInitialized = true;
    logger.info(
      {
        environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
        tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
      },
      "Sentry initialized successfully"
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to initialize Sentry"
    );
  }
}

/**
 * Setup Fastify error handler for Sentry
 * Call this after initializing Sentry and creating Fastify instance
 */
export function setupFastifyErrorHandler(app: import("fastify").FastifyInstance): void {
  if (!isInitialized) {
    return;
  }

  try {
    Sentry.setupFastifyErrorHandler(app);
    logger.debug("Sentry Fastify error handler setup completed");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to setup Sentry Fastify error handler"
    );
  }
}

/**
 * Capture an exception to Sentry with optional context
 * Only captures if Sentry is initialized
 */
export function captureException(
  error: unknown,
  context?: {
    userId?: string;
    workspaceId?: string;
    requestId?: string;
    [key: string]: unknown;
  }
): void {
  if (!isInitialized) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      // Set user context if provided
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }

      // Set tags
      if (context?.workspaceId) {
        scope.setTag("workspaceId", context.workspaceId);
      }
      if (context?.requestId) {
        scope.setTag("requestId", context.requestId);
      }

      // Set additional context
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          if (key !== "userId" && key !== "workspaceId" && key !== "requestId") {
            scope.setContext(key, { value });
          }
        });
      }

      Sentry.captureException(error);
    });
  } catch (err) {
    // Don't let Sentry errors break the app
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Failed to capture exception to Sentry"
    );
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

