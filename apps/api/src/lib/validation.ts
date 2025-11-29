import { z, ZodSchema, ZodTypeAny } from 'zod';
import { FastifyRequest } from 'fastify';
import { BadRequestError } from './http-errors.js';

/**
 * Validates request body against a Zod schema
 * @param schema - Zod schema to validate against
 * @param request - Fastify request object
 * @returns Validated and typed body data
 * @throws BadRequestError if validation fails
 */
export function validateBody<TSchema extends ZodTypeAny>(
  schema: TSchema,
  request: FastifyRequest
): z.infer<TSchema> {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    throw new BadRequestError('INVALID_BODY', 'Invalid request body', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function validateParams<T>(schema: ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestError('INVALID_PARAMS', 'Invalid route parameters', parsed.error.flatten());
  }
  return parsed.data;
}
