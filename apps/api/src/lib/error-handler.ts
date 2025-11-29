import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from './logger.js';
import { HttpError } from './http-errors.js';
import { appConfig } from '../config/app-config.js';

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
  // Log the error with request context
  logger.error(
    {
      err: error,
      method: request.method,
      url: request.url,
      statusCode: error.statusCode || 500,
    },
    'Error handled by global error handler'
  );

  // Determine status code
  const statusCode = (error as HttpError).statusCode ?? error.statusCode ?? 500;

  // Map error code
  const errorCode =
    (error as HttpError).code ??
    (typeof error.code === 'string' ? error.code : undefined) ??
    mapErrorCode(error);

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
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  };

  reply.status(404).send(errorResponse);
}
