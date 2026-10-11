import { firstName } from '@buddy/shared';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useBlocked, useSetBlocked } from '@/api/queries';
import { Avatar, Button, LoadError, Loading, ScreenHeader } from '@/components/ui';
import { toast } from '@/store/ui';

/** Profile → Blocked people: everyone you blocked, with a way to unblock. */
export default function BlockedPeopleScreen() {
  const blocked = useBlocked();
  const setBlocked = useSetBlocked();

  const unblock = (id: string, name: string) =>
    setBlocked.mutate(
      { userId: id, blocked: false },
      {
        onSuccess: () => toast(`Unblocked ${firstName(name)}.`),
        onError: (err) => toast(errorMessage(err)),
      },
    );

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Blocked people" />
      <FlatList
        style={styles.fill}
        data={blocked.data ?? []}
        keyExtractor={(person) => person.id}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View className="mb-5">
            <Text className="font-sans text-[15px] leading-[22px] text-muted">
              You won’t see each other’s activities or messages, and they can’t view your profile.
              They aren’t told.
            </Text>
            {blocked.isLoading ? <Loading /> : null}
            {blocked.error ? (
              <View className="mt-6">
                <LoadError
                  error={blocked.error}
                  onRetry={() => void blocked.refetch()}
                  stale={!!blocked.data}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          blocked.data ? (
            <Text className="mt-3 text-center font-sans text-[15px] text-muted">
              You haven’t blocked anyone.
            </Text>
          ) : null
        }
        renderItem={({ item: person }) => (
          <View className="flex-row items-center gap-3.5 border-b border-divider py-3.5">
            <Avatar uri={person.avatarUrl ?? undefined} name={person.name} size={44} />
            <Text className="flex-1 font-sans-medium text-[16px] text-ink" numberOfLines={1}>
              {person.name}
            </Text>
            <Button
              label="Unblock"
              variant="outline"
              size="sm"
              disabled={setBlocked.isPending}
              onPress={() => unblock(person.id, person.name)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
