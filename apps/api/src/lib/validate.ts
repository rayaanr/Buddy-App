import { ERROR_CODES } from '@buddy/shared';
import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { z, type ZodType } from 'zod';

import { HttpError } from './errors';

/**
 * Validates part of a request against a shared Zod schema. Failures become
 * the standard 400 ApiError with per-field issues in `details`.
 */
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HttpError(400, ERROR_CODES.validation, 'Some fields are invalid', {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
  });

/** Validates the `:id` path parameter as a UUID (otherwise 400, never a database error). */
export const idParam = () => validate('param', z.object({ id: z.uuid() }));
