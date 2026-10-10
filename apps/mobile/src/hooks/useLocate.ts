import { useMutation } from '@tanstack/react-query';

import { errorMessage } from '@/api/client';
import { currentPoint, type Point } from '@/lib/location';
import { toast } from '@/store/ui';

/**
 * "Near me" / "Use where I am": asks for the phone's position (and
 * permission, the first time), hands it to `onFound`, and toasts any failure.
 * `precise` asks for a pinned-meeting-point level of accuracy.
 */
export function useLocate(onFound: (point: Point) => unknown, { precise = false } = {}) {
  const mutation = useMutation({
    mutationFn: async () => {
      await onFound(await currentPoint(precise));
    },
    onError: (err) => toast(errorMessage(err)),
  });
  return { locating: mutation.isPending, locate: () => mutation.mutate() };
}
