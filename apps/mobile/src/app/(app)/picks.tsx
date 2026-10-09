import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SwipeDeck } from '@/components/picks/SwipeDeck';
import { CloseIcon, Heading } from '@/components/ui';
import { useDeckIds } from '@/hooks/useDeck';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { deckReason, firstName, shortLocation } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import { useAccount, useSessionStore } from '@/store/session';
import { toast } from '@/store/ui';

/** "Picked for you" — Tinder-style deck shown to returning users. */
export default function PicksScreen() {
  const { top } = useScreenInsets();
  const account = useAccount();
  const interests = useSessionStore((s) => s.interests);
  const activities = useActivitiesStore((s) => s.activities);
  const communities = useActivitiesStore((s) => s.communities);
  const deckIds = useDeckIds();

  // Freeze the deck when it opens so cards don't reshuffle while swiping.
  const [ids] = useState(deckIds);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ids.length === 0) router.back();
  }, [ids.length]);

  const byId = (id?: string) => activities.find((a) => a.id === id);
  const card = byId(ids[index]);
  const next = byId(ids[index + 1]);

  const onDecide = (like: boolean) => {
    const current = ids[index];
    if (like && current) {
      // First "yes" closes the deck and opens that activity.
      router.replace(`/activity/${current}`);
      return;
    }
    if (index + 1 >= ids.length) {
      router.back();
      toast('You’re all caught up.');
      return;
    }
    setIndex(index + 1);
  };

  return (
    <View className="flex-1 bg-bg">
      <View
        className="flex-row items-start justify-between px-[22px]"
        style={{ paddingTop: top(60) }}
      >
        <View className="flex-1">
          <Text className="font-mono-medium text-[12px] tracking-[1.44px] text-lime">
            PICKED FOR YOU · {Math.min(index + 1, ids.length)} OF {ids.length}
          </Text>
          <Heading size="section" className="mt-2">
            Welcome back, {firstName(account.name)}
          </Heading>
          <Text className="mt-1.5 font-sans text-[14.5px] text-muted">
            Near {shortLocation(account.location)}, based on what you’re into.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="h-11 w-11 items-center justify-center rounded-full bg-surface active:opacity-70"
        >
          <CloseIcon />
        </Pressable>
      </View>

      {card ? (
        <SwipeDeck
          top={card}
          next={next}
          index={index}
          reason={deckReason(card, interests, communities)}
          onDecide={onDecide}
        />
      ) : null}
    </View>
  );
}
