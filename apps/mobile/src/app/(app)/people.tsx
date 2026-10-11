import { type AdminPerson, firstName, monthYear } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useAdminPeople, useLiftSuspension, useMe, useSuspendPerson } from '@/api/queries';
import {
  ActionSheet,
  Avatar,
  ConfirmDialog,
  EmptyState,
  LoadError,
  ScreenHeader,
  SearchField,
} from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { toast } from '@/store/ui';
import { spacing } from '@/theme';

/**
 * Settings → People (Buddy team only): find anyone by name or email, and
 * suspend them without waiting for a report, or let them back in.
 */
export default function PeopleScreen() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const people = useAdminPeople(q);
  const me = useMe().data;
  const suspend = useSuspendPerson();
  const lift = useLiftSuspension();
  const [picked, setPicked] = useState<AdminPerson | null>(null);
  const [confirming, setConfirming] = useState<AdminPerson | null>(null);
  const searching = q.length >= 2;

  const onSuspend = (p: AdminPerson) =>
    suspend.mutate(p.id, {
      onSuccess: () => toast(`${firstName(p.name)} is suspended.`),
      onError: (err) => toast(errorMessage(err)),
    });
  const onLift = (p: AdminPerson) =>
    lift.mutate(p.id, {
      onSuccess: () => toast(`${firstName(p.name)} can sign in again.`),
      onError: (err) => toast(errorMessage(err)),
    });

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="People" />
      <FlatList
        style={styles.fill}
        data={searching ? (people.data ?? []) : []}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: spacing.edge,
          paddingTop: 12,
          paddingBottom: 30,
        }}
        ListHeaderComponent={
          <View className="mb-3">
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Name or email"
              label="Find a person"
            />
            {people.error ? (
              <View className="mt-4">
                <LoadError
                  error={people.error}
                  onRetry={() => void people.refetch()}
                  stale={!!people.data}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !searching ? (
            <Text className="mt-2 font-sans text-label leading-label text-muted">
              Anyone on Buddy, by name or email. Tap someone to see what you can do.
            </Text>
          ) : people.data ? (
            <EmptyState card title={`Nobody matches “${q}”`} subtitle="Try part of their email." />
          ) : null
        }
        renderItem={({ item: p }) => (
          <Pressable
            onPress={() => setPicked(p)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-b border-divider py-3 active:opacity-70"
          >
            <Avatar uri={p.avatarUrl ?? undefined} name={p.name} size={40} />
            <View className="min-w-0 flex-1">
              <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
                {p.name}
              </Text>
              <Text className="mt-0.5 font-sans text-footnote text-muted" numberOfLines={1}>
                {p.email} · since {monthYear(new Date(p.joinedAt))}
              </Text>
            </View>
            {p.suspended ? (
              <Text className="rounded-full bg-danger/15 px-2 py-0.5 font-sans-medium text-caption text-danger">
                Suspended
              </Text>
            ) : null}
          </Pressable>
        )}
      />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.name}
        message={picked?.email}
        actions={
          picked
            ? [
                { label: 'View profile', onPress: () => router.push(`/user/${picked.id}`) },
                ...(picked.id === me?.id
                  ? []
                  : picked.suspended
                    ? [{ label: 'Lift suspension', onPress: () => onLift(picked) }]
                    : [
                        {
                          label: `Suspend ${firstName(picked.name)}`,
                          destructive: true,
                          onPress: () => setConfirming(picked),
                        },
                      ]),
              ]
            : []
        }
      />

      <ConfirmDialog
        visible={!!confirming}
        onClose={() => setConfirming(null)}
        title={confirming ? `Suspend ${firstName(confirming.name)}?` : ''}
        message="They’re signed out everywhere and can’t sign back in. Activities they host are called off and everyone going is told. You can lift it later."
        actions={[
          {
            label: 'Suspend',
            destructive: true,
            onPress: () => confirming && onSuspend(confirming),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
