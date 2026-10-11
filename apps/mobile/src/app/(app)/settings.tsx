import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { unregisterPush } from '@/api/push';
import { signOut, useMe, useUpdateMe } from '@/api/queries';
import {
  ChevronRightIcon,
  ConfirmDialog,
  ScreenHeader,
  SectionLabel,
  Toggle,
} from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/config';
import { cn } from '@/lib/cn';
import { toast } from '@/store/ui';
import { spacing } from '@/theme';

/** Profile → Settings: account details and the less common account actions. */
export default function SettingsScreen() {
  const me = useMe();
  const [confirmLogOut, setConfirmLogOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const logOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await unregisterPush();
    await signOut();
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Settings" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: spacing.edge,
          paddingTop: 12,
          paddingBottom: 30,
        }}
      >
        <SectionLabel className="mb-1 mt-2">Account</SectionLabel>
        <View className="flex-row items-center justify-between border-b border-divider py-3.5">
          <Text className="font-sans text-body text-ink">Email</Text>
          <Text className="font-sans text-subhead text-muted" numberOfLines={1}>
            {me.data?.email ?? ''}
          </Text>
        </View>

        <SectionLabel className="mb-1 mt-7">Notifications</SectionLabel>
        <NotificationSwitch
          kind="chat"
          label="Group chat messages"
          sub="Mute a single chat from its ⋯ menu, or by holding it in Chats."
        />
        <NotificationSwitch
          kind="reminders"
          label="Reminders and changes"
          sub="A day and an hour before, how was it, new times, cancellations, waitlist spots."
        />
        <NotificationSwitch
          kind="communities"
          label="New in your communities"
          sub="When someone posts an activity in a community you’re in."
        />

        {me.data?.isAdmin ? (
          <>
            <SectionLabel className="mb-1 mt-7">Buddy team</SectionLabel>
            <Row label="Dashboard" onPress={() => router.push('/admin')} />
            <Row label="Moderation" onPress={() => router.push('/moderation')} />
            <Row label="People" onPress={() => router.push('/people')} />
          </>
        ) : null}

        <SectionLabel className="mb-1 mt-7">Privacy</SectionLabel>
        <Row label="Blocked people" onPress={() => router.push('/blocked')} />
        <Row label="Privacy policy" onPress={() => void openBrowserAsync(PRIVACY_URL)} />
        <Row label="Terms of use" onPress={() => void openBrowserAsync(TERMS_URL)} />

        <View className="mt-10">
          <Row label="Log out" onPress={() => setConfirmLogOut(true)} />
          <Row label="Delete account" danger onPress={() => router.push('/delete-account')} />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLogOut}
        onClose={() => setConfirmLogOut(false)}
        title="Log out of Buddy?"
        message="You can sign back in with a code sent to your email."
        actions={[{ label: 'Log out', destructive: true, onPress: logOut }]}
      />
    </View>
  );
}

function NotificationSwitch({
  kind,
  label,
  sub,
}: {
  kind: 'chat' | 'reminders' | 'communities';
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
        <Text className="font-sans text-body text-ink">{label}</Text>
        <Text className="mt-0.5 font-sans text-footnote leading-footnote text-muted">{sub}</Text>
      </View>
      <Toggle
        value={value}
        onValueChange={(on) =>
          update.mutate(
            { notifications: { [kind]: on } },
            { onError: (err) => toast(errorMessage(err)) },
          )
        }
        label={label}
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
      <Text className={cn('font-sans text-body', danger ? 'text-danger' : 'text-ink')}>
        {label}
      </Text>
      <ChevronRightIcon />
    </Pressable>
  );
}
