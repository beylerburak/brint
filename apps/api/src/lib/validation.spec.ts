import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BadRequestError } from './http-errors.js';
import { validateBody, validateQuery, validateParams, mapZodError } from './validation.js';
import type { FastifyRequest } from 'fastify';

describe('validation helpers', () => {
  describe('mapZodError', () => {
    it('should map ZodError to validation error items', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const result = schema.safeParse({
        email: 'invalid-email',
        age: 15,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = mapZodError(result.error);
        expect(errors).toHaveLength(2);
        expect(errors[0]).toMatchObject({
          path: ['email'],
          code: 'invalid_string',
        });
        expect(errors[1]).toMatchObject({
          path: ['age'],
          code: 'too_small',
        });
      }
    });
  });

  describe('validateBody', () => {
    const emailSchema = z.object({
      email: z.string().email(),
    });

    it('should return parsed value for valid body', () => {
      const request = {
        body: { email: 'test@example.com' },
      } as FastifyRequest;

      const result = validateBody(emailSchema, request);
      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should throw BadRequestError with VALIDATION_ERROR code for invalid body', () => {
      const request = {
        body: { email: 'invalid-email' },
      } as FastifyRequest;

      expect(() => validateBody(emailSchema, request)).toThrow(BadRequestError);
      
      try {
        validateBody(emailSchema, request);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as BadRequestError).code).toBe('VALIDATION_ERROR');
        expect((error as BadRequestError).message).toBe('Validation failed');
        expect((error as BadRequestError).details).toBeDefined();
        expect((error as BadRequestError).details).toHaveProperty('errors');
        const details = (error as BadRequestError).details as { errors: unknown[] };
        expect(Array.isArray(details.errors)).toBe(true);
        expect(details.errors.length).toBeGreaterThan(0);
      }
    });

    it('should throw BadRequestError for missing required fields', () => {
      const request = {
        body: {},
      } as FastifyRequest;

      expect(() => validateBody(emailSchema, request)).toThrow(BadRequestError);
      
      try {
        validateBody(emailSchema, request);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as BadRequestError).code).toBe('VALIDATION_ERROR');
        const details = (error as BadRequestError).details as { errors: unknown[] };
        expect(details.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateQuery', () => {
    const paginationSchema = z.object({
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
    });

    it('should return parsed value for valid query', () => {
      const query = { limit: 10, cursor: 'abc123' };
      const result = validateQuery(paginationSchema, query);
      expect(result).toEqual({ limit: 10, cursor: 'abc123' });
    });

    it('should handle optional fields', () => {
      const query = {};
      const result = validateQuery(paginationSchema, query);
      expect(result).toEqual({ limit: undefined, cursor: undefined });
    });

    it('should throw BadRequestError with VALIDATION_ERROR code for invalid query', () => {
      const query = { limit: 200 }; // exceeds max

      expect(() => validateQuery(paginationSchema, query)).toThrow(BadRequestError);
      
      try {
        validateQuery(paginationSchema, query);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as BadRequestError).code).toBe('VALIDATION_ERROR');
        expect((error as BadRequestError).message).toBe('Validation failed');
        const details = (error as BadRequestError).details as { errors: unknown[] };
        expect(Array.isArray(details.errors)).toBe(true);
        expect(details.errors.length).toBeGreaterThan(0);
      }
    });

    it('should throw BadRequestError for invalid types', () => {
      const query = { limit: 'not-a-number' };

      expect(() => validateQuery(paginationSchema, query)).toThrow(BadRequestError);
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      workspaceId: z.string().uuid(),
      userId: z.string().uuid(),
    });

    it('should return parsed value for valid params', () => {
      const params = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
      };
      const result = validateParams(paramsSchema, params);
      expect(result).toEqual(params);
    });

    it('should throw BadRequestError with VALIDATION_ERROR code for invalid params', () => {
      const params = {
        workspaceId: 'invalid-uuid',
        userId: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(() => validateParams(paramsSchema, params)).toThrow(BadRequestError);
      
      try {
        validateParams(paramsSchema, params);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as BadRequestError).code).toBe('VALIDATION_ERROR');
        expect((error as BadRequestError).message).toBe('Validation failed');
        const details = (error as BadRequestError).details as { errors: unknown[] };
        expect(Array.isArray(details.errors)).toBe(true);
        expect(details.errors.length).toBeGreaterThan(0);
      }
    });
  });
});

