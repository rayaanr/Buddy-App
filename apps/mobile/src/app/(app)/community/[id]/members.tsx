import { firstName } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useCommunity, useCommunityMembers, useMe, useRemoveCommunityMember } from '@/api/queries';
import {
  Avatar,
  ConfirmDialog,
  LoadError,
  Loading,
  Menu,
  MoreIcon,
  ScreenHeader,
} from '@/components/ui';
import { toast } from '@/store/ui';

type Member = { id: string; name: string; avatarUrl: string | null; isCreator: boolean };

/** Community → members: everyone in it. Whoever started it can remove people. */
export default function CommunityMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const community = useCommunity(id);
  const members = useCommunityMembers(id);
  const me = useMe();
  const remove = useRemoveCommunityMember(id);
  const [removing, setRemoving] = useState<Member | null>(null);
  const canRemove = !!community.data?.isCreator;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Members" />
      <FlatList
        style={styles.fill}
        data={members.data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View className="mb-4">
            {community.data ? (
              <Text className="font-sans text-[14.5px] text-muted">
                {community.data.name} · {community.data.memberCount}
              </Text>
            ) : null}
            {members.isLoading ? <Loading className="py-10" /> : null}
            {members.error ? (
              <View className="mt-4">
                <LoadError
                  error={members.error}
                  onRetry={() => void members.refetch()}
                  stale={!!members.data}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: m }) => (
          <View className="flex-row items-center border-b border-divider">
            <Pressable
              onPress={() => router.push(`/user/${m.id}`)}
              accessibilityRole="button"
              className="flex-1 flex-row items-center gap-3 py-3 active:opacity-70"
            >
              <Avatar uri={m.avatarUrl ?? undefined} name={m.name} size={40} />
              <Text className="flex-1 font-sans-medium text-[15.5px] text-ink" numberOfLines={1}>
                {m.name}
                {m.id === me.data?.id ? <Text className="text-muted"> (you)</Text> : null}
              </Text>
              {m.isCreator ? (
                <Text className="font-mono-medium text-[11px] uppercase tracking-[1px] text-lime">
                  Started it
                </Text>
              ) : null}
            </Pressable>
            {canRemove && !m.isCreator ? (
              <Menu
                label={`Options for ${m.name}`}
                trigger={
                  <View className="ml-2 h-9 w-9 items-center justify-center rounded-full">
                    <MoreIcon size={18} />
                  </View>
                }
                items={[
                  {
                    label: 'Remove from community',
                    destructive: true,
                    onPress: () => setRemoving(m),
                  },
                ]}
              />
            ) : null}
          </View>
        )}
      />

      <ConfirmDialog
        visible={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${firstName(removing.name)}?` : ''}
        message="They leave the community and can’t join again. Activities they host stay up."
        actions={[
          {
            label: 'Remove from community',
            destructive: true,
            onPress: () => {
              const who = removing!;
              remove.mutate(who.id, {
                onSuccess: () => toast(`${firstName(who.name)} was removed.`),
                onError: (err) => toast(errorMessage(err)),
              });
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
