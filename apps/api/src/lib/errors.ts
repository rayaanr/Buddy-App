import { ERROR_CODES, type ApiError } from '@buddy/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Thrown anywhere in a request; the error handler turns it into an ApiError response. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const notFound = (what: string) =>
  new HttpError(404, ERROR_CODES.notFound, `${what} not found`);
export const badRequest = (message: string) => new HttpError(400, ERROR_CODES.validation, message);
export const forbidden = (message: string) => new HttpError(403, ERROR_CODES.forbidden, message);
export const conflict = (message: string, code: string = ERROR_CODES.conflict) =>
  new HttpError(409, code, message);
export const unauthorized = () =>
  new HttpError(401, ERROR_CODES.unauthorized, 'Sign in to continue');
