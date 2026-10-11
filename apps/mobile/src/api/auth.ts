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
export async function verifySignInCode(email: string, otp: string) {
  const { data, error } = await authClient.signIn.emailOtp({
    email: email.trim().toLowerCase(),
    otp,
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

/**
 * Google sign-in in a browser sheet. A new Google account gets a Buddy account
 * (and onboarding); an address that already signed up by code gets its own
 * account back. Resolves with `false` if the person closes the sheet.
 */
export async function signInWithGoogle() {
  const { data, error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
  if (error) {
    throw new ApiRequestError(
      error.status ?? 0,
      error.code ?? 'google_failed',
      error.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : 'Couldn’t sign in with Google. Try again, or use your email.',
    );
  }
  return !!data;
}
