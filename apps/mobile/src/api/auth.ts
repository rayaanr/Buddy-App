import { authClient } from './auth-client';
import { ApiRequestError } from './client';

/** Emails a 6-digit sign-in code. New addresses get an account on first sign-in. */
export async function sendSignInCode(email: string) {
  const { error } = await authClient.emailOtp.sendVerificationOtp({
    email: email.trim().toLowerCase(),
    type: 'sign-in',
  });
  if (error) {
    throw new ApiRequestError(
      error.status ?? 0,
      error.code ?? 'send_failed',
      error.status === 429
        ? 'Too many codes requested. Wait a minute and try again.'
        : 'Couldn’t send the code. Check the address and try again.',
    );
  }
}

/** Confirms the code; `name` is used only when this creates a new account. */
export async function verifySignInCode(email: string, otp: string, name?: string) {
  const { data, error } = await authClient.signIn.emailOtp({
    email: email.trim().toLowerCase(),
    otp,
    ...(name ? { name } : {}),
  });
  if (error || !data) {
    throw new ApiRequestError(
      error?.status ?? 0,
      error?.code ?? 'invalid_code',
      error?.status === 429
        ? 'Too many attempts. Request a new code.'
        : 'That code didn’t work. Check it and try again.',
    );
  }
  return data.user;
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
