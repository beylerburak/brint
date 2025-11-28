import { z } from 'zod';
import type { FieldRule } from './rules.js';

/**
 * Builds a string schema from a rule definition.
 * Error mesajı yerine i18n key vermek için baseKey kullanabilirsiniz.
 */
export function buildStringSchema(rule: FieldRule, baseKey?: string) {
  let schema = z.string();

  if (rule.minLength !== undefined) {
    schema = schema.min(rule.minLength, baseKey ? `${baseKey}.min` : undefined);
  }
  if (rule.maxLength !== undefined) {
    schema = schema.max(rule.maxLength, baseKey ? `${baseKey}.max` : undefined);
  }
  if (rule.pattern) {
    schema = schema.regex(rule.pattern, baseKey ? `${baseKey}.pattern` : undefined);
  }

  return schema;
}

export const emailSchema = z.string().email('validation.email.invalid');
