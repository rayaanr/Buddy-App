import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useMe } from '@/api/queries';
import { BackButton, ChevronRightIcon, Heading, SectionLabel } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';

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

        <SectionLabel className="mb-1 mt-7">Privacy</SectionLabel>
        <Row label="Blocked people" onPress={() => router.push('/blocked')} />

        <View className="mt-10">
          <Row label="Delete account" danger onPress={() => router.push('/delete-account')} />
        </View>
      </ScrollView>
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
