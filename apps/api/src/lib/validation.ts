import { z, ZodError, ZodSchema, ZodTypeAny } from 'zod';
import { FastifyRequest } from 'fastify';
import { BadRequestError } from './http-errors.js';

/**
 * Validation error item format
 */
export type ValidationErrorItem = {
  path: (string | number)[];
  code: string;
  message: string;
};

/**
 * Maps ZodError to a standardized validation error format
 * @param error - ZodError instance
 * @returns Array of validation error items
 */
export function mapZodError(error: ZodError): ValidationErrorItem[] {
  return error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Validates request body against a Zod schema
 * @param schema - Zod schema to validate against
 * @param request - Fastify request object
 * @returns Validated and typed body data
 * @throws BadRequestError with code "VALIDATION_ERROR" if validation fails
 */
export function validateBody<TSchema extends ZodTypeAny>(
  schema: TSchema,
  request: FastifyRequest
): z.infer<TSchema> {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    throw new BadRequestError('VALIDATION_ERROR', 'Validation failed', {
      errors: mapZodError(result.error),
    });
  }
  return result.data;
}

/**
 * Validates request query parameters against a Zod schema
 * @param schema - Zod schema to validate against
 * @param query - Query parameters object
 * @returns Validated and typed query data
 * @throws BadRequestError with code "VALIDATION_ERROR" if validation fails
 */
export function validateQuery<TSchema extends ZodTypeAny>(
  schema: TSchema,
  query: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new BadRequestError('VALIDATION_ERROR', 'Validation failed', {
      errors: mapZodError(result.error),
    });
  }
  return result.data;
}

/**
 * Validates request route parameters against a Zod schema
 * @param schema - Zod schema to validate against
 * @param value - Route parameters object
 * @returns Validated and typed params data
 * @throws BadRequestError with code "VALIDATION_ERROR" if validation fails
 */
export function validateParams<T>(schema: ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestError('VALIDATION_ERROR', 'Validation failed', {
      errors: mapZodError(parsed.error),
    });
  }
  return parsed.data;
}
