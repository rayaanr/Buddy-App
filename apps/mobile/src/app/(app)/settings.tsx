import { router } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { BackButton, ChevronRightIcon, Heading, SectionLabel } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

/** Profile → Settings: account details and the less common account actions. */
export default function SettingsScreen() {
  const { top } = useScreenInsets();
  const me = useMe();

  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}
      >
        <Heading size="page">Settings</Heading>

        <SectionLabel className="mb-1 mt-7">Account</SectionLabel>
        <View className="flex-row items-center justify-between border-b border-divider py-3.5">
          <Text className="font-sans text-[15.5px] text-ink">Email</Text>
          <Text className="font-sans text-[15px] text-muted" numberOfLines={1}>
            {me.data?.email ?? ''}
          </Text>
        </View>

        <SectionLabel className="mb-1 mt-7">Notifications</SectionLabel>
        <NotificationSwitch
          kind="chat"
          label="Group chat messages"
          sub="Mute a single chat from its activity’s ⋯ menu."
        />
        <NotificationSwitch
          kind="reminders"
          label="Reminders and changes"
          sub="Coming up, how was it, new times, cancellations, waitlist spots."
        />

        <SectionLabel className="mb-1 mt-7">Privacy</SectionLabel>
        <Row label="Blocked people" onPress={() => router.push('/blocked')} />

        <View className="mt-10">
          <Row label="Delete account" danger onPress={() => router.push('/delete-account')} />
        </View>
      </ScrollView>
    </View>
  );
}

function NotificationSwitch({
  kind,
  label,
  sub,
}: {
  kind: 'chat' | 'reminders';
  label: string;
  sub: string;
}) {
  const me = useMe();
  const update = useUpdateMe();
  // Show the new position straight away while it saves.
  const saving = update.isPending ? update.variables.notifications?.[kind] : undefined;
  const value = saving ?? me.data?.notifications[kind] ?? true;

  return (
    <View className="flex-row items-center gap-4 border-b border-divider py-3.5">
      <View className="flex-1">
        <Text className="font-sans text-[15.5px] text-ink">{label}</Text>
        <Text className="mt-0.5 font-sans text-[13px] leading-[18px] text-muted">{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(on) =>
          update.mutate(
            { notifications: { [kind]: on } },
            { onError: (err) => toast(errorMessage(err)) },
          )
        }
        accessibilityLabel={label}
        trackColor={{ false: colors.outline, true: colors.lime }}
        thumbColor={value ? colors.bg : colors.ink}
        ios_backgroundColor={colors.outline}
        // react-native-web colours the "on" thumb with its own prop.
        {...{ activeThumbColor: colors.bg }}
      />
    </View>
  );
}

function Row({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center justify-between border-b border-divider py-3.5 active:opacity-80"
    >
      <Text className={cn('font-sans text-[15.5px]', danger ? 'text-danger' : 'text-ink')}>
        {label}
      </Text>
      <ChevronRightIcon />
    </Pressable>
  );
}
