import { ZodSchema } from 'zod';
import { BadRequestError } from './http-errors.js';

export function validateBody<T>(schema: ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestError('INVALID_BODY', 'Invalid request payload', parsed.error.flatten());
  }
  return parsed.data;
}

export function validateParams<T>(schema: ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestError('INVALID_PARAMS', 'Invalid route parameters', parsed.error.flatten());
  }
  return parsed.data;
}
