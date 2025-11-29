import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from './logger.js';
import { HttpError } from './http-errors.js';
import { appConfig } from '../config/app-config.js';
import { captureException } from '../core/observability/sentry.js';
import { getRequestId } from '../core/http/request-id.js';

/**
 * Standard error response format for all API errors
 */
export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Maps Fastify error codes to standardized error codes
 */
function mapErrorCode(error: FastifyError): string {
  if (error.code === 'FST_ERR_NOT_FOUND') {
    return 'NOT_FOUND';
  }

  if (typeof error.code === 'string') {
    return error.code;
  }
  return 'INTERNAL_SERVER_ERROR';
}

/**
 * Global error handler for Fastify
 * Catches all errors and returns them in a standardized format
 */
export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Extract request context
  const requestId = getRequestId(request);
  const userId = (request as any).auth?.userId ?? undefined;
  const workspaceId = (request as any).auth?.workspaceId ?? undefined;
  const statusCode = (error as HttpError).statusCode ?? error.statusCode ?? 500;

  // Log the error with structured context
  logger.error(
    {
      msg: "Request failed",
      err: error,
      requestId,
      userId,
      workspaceId,
      method: request.method,
      path: request.url,
      statusCode,
    },
    'Error handled by global error handler'
  );

  // Map error code
  const errorCode =
    (error as HttpError).code ??
    (typeof error.code === 'string' ? error.code : undefined) ??
    mapErrorCode(error);

  // Send to Sentry for 5xx errors (server errors)
  // Skip 4xx errors (client errors) unless they're unexpected
  if (statusCode >= 500 || (statusCode >= 400 && !(error as HttpError).code)) {
    captureException(error, {
      requestId,
      userId,
      workspaceId,
      method: request.method,
      path: request.url,
      statusCode,
      errorCode,
    });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: error.message || 'An unexpected error occurred',
      details:
        (error as HttpError).details ??
        (appConfig.isDev && appConfig.exposeStackTraces && error.stack
          ? error.stack
          : undefined),
    },
  };

  // Send response
  reply.status(statusCode).send(errorResponse);
}

/**
 * 404 Not Found handler
 * Returns standardized error response for routes that don't exist
 */
export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = getRequestId(request);
  
  // Log 404 with request context
  logger.warn(
    {
      msg: "Route not found",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 404,
    },
    '404 Not Found'
  );

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  };

  reply.status(404).send(errorResponse);
}
