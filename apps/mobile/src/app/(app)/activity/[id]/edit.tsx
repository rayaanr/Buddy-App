import { LIMITS, type UpdateActivityInput } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useActivity, useUpdateActivity } from '@/api/queries';
import { ActivityForm, draftFrom } from '@/components/create/ActivityForm';
import { QueryFallback } from '@/components/ui';
import { toast } from '@/store/ui';

/** Host → ⋯ → Edit activity. Only what changed is sent. */
export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  const update = useUpdateActivity(id);
  const a = activity.data;
  if (!a)
    return <QueryFallback query={activity} notFound="This activity is no longer available." />;

  return (
    <ActivityForm
      heading="Edit activity"
      initial={draftFrom(a)}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      pending={update.isPending}
      initialCover={a.coverUrl}
      minSpots={Math.max(LIMITS.capacityMin, a.goingCount)}
      onSubmit={(v) => {
        const startsAt = v.startsAt.toISOString();
        const patch: UpdateActivityInput = {
          ...(v.coverKey !== undefined && { coverKey: v.coverKey }),
          ...(v.location &&
            (v.location.lat !== a.location.lat || v.location.lng !== a.location.lng) && {
              location: v.location,
            }),
          ...(v.title !== a.title && { title: v.title }),
          ...(v.group !== a.group && { group: v.group }),
          ...(startsAt !== a.startsAt && { startsAt }),
          ...(v.place !== a.place && { place: v.place }),
          ...(v.capacity !== a.capacity && { capacity: v.capacity }),
          ...(v.description !== a.description && { description: v.description }),
          ...(v.repeatsWeekly !== a.repeatsWeekly && { repeatsWeekly: v.repeatsWeekly }),
        };
        // Opened from a link, there's no screen behind it to go back to.
        const done = () => (router.canGoBack() ? router.back() : router.replace(`/activity/${id}`));
        if (Object.keys(patch).length === 0) return done();
        update.mutate(patch, {
          onSuccess: () => {
            done();
            toast(
              patch.startsAt || patch.place
                ? 'Saved. Everyone going has been told.'
                : 'Changes saved.',
            );
          },
          onError: (err) => toast(errorMessage(err)),
        });
      }}
    />
  );
}
