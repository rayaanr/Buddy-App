import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { sendSignInCode } from '@/api/auth';
import { errorMessage } from '@/api/client';

/**
 * Emails a sign-in code, then opens the code screen. `onSent` runs first
 * (Sign up uses it to keep the details for after the code).
 */
export function useSendCode(onSent?: (email: string) => void) {
  const mutation = useMutation({
    mutationFn: (email: string) => sendSignInCode(email),
    onSuccess: (_, email) => {
      const normalised = email.trim().toLowerCase();
      onSent?.(normalised);
      router.push({ pathname: '/verify', params: { email: normalised } });
    },
  });
  return {
    send: (email: string) => mutation.mutate(email),
    sending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
  };
}
