import type { AppType } from '@buddy/api/app';
import type { ApiError } from '@buddy/shared';
import { hc, type ClientResponse } from 'hono/client';

import { API_URL } from '@/config';
import { sessionCookie } from './auth-client';

/**
 * Typed client generated from the API's routes. Only the *type* comes from
 * apps/api; no server code is bundled into the app.
 */
export const api = hc<AppType>(API_URL, {
  headers: async (): Promise<Record<string, string>> => {
    const cookie = await sessionCookie();
    return cookie ? { cookie } : {};
  },
  init: { credentials: 'include' },
}).v1;

/** A non-2xx response, carrying the API's error code for branching in the UI. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Returns the JSON body of a successful response, or throws ApiRequestError. */
export async function unwrap<T>(
  request: Promise<ClientResponse<T>>,
): Promise<Exclude<T, ApiError>> {
  let res: ClientResponse<T>;
  try {
    res = await request;
  } catch {
    throw new ApiRequestError(0, 'network_error', 'Can’t reach Buddy. Check your connection.');
  }
  if (res.status === 204) return undefined as Exclude<T, ApiError>;
  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? 'Something went wrong',
    );
  }
  return body as Exclude<T, ApiError>;
}

/** User-facing message for any error thrown by a query or mutation. */
export const errorMessage = (err: unknown) =>
  err instanceof ApiRequestError ? err.message : 'Something went wrong. Try again.';
