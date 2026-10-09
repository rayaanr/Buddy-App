import type { Pick } from '@buddy/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useMe, usePicks } from '@/api/queries';
import { SwipeDeck } from '@/components/picks/SwipeDeck';
import { CloseIcon, Heading, Loading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { firstName } from '@/lib/activity';
import { toast } from '@/store/ui';

/** "Picked for you": Tinder-style deck shown to returning users. */
export default function PicksScreen() {
  const { top } = useScreenInsets();
  const me = useMe();
  const picks = usePicks();

  // Freeze the deck once loaded so cards don't reshuffle while swiping
  // (set during render: React's pattern for state derived from props/queries).
  const [deck, setDeck] = useState<Pick[] | null>(picks.data ?? null);
  const [index, setIndex] = useState(0);
  if (!deck && picks.data) setDeck(picks.data);
  useEffect(() => {
    if (deck?.length === 0 || picks.error) router.back();
  }, [deck, picks.error]);

  const card = deck?.[index];
  const next = deck?.[index + 1];

  const onDecide = (like: boolean) => {
    if (!deck || !card) return;
    if (like) {
      // First "yes" closes the deck and opens that activity.
      router.replace(`/activity/${card.activity.id}`);
      return;
    }
    if (index + 1 >= deck.length) {
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
            PICKED FOR YOU{deck ? ` · ${Math.min(index + 1, deck.length)} OF ${deck.length}` : ''}
          </Text>
          <Heading size="section" className="mt-2">
            Welcome back{me.data ? `, ${firstName(me.data.name)}` : ''}
          </Heading>
          <Text className="mt-1.5 font-sans text-[14.5px] text-muted">
            Near {me.data?.area ?? 'you'}, based on what you’re into.
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

      {!deck ? <Loading className="flex-1" /> : null}
      {card ? (
        <SwipeDeck
          top={card.activity}
          next={next?.activity}
          index={index}
          reason={card.reason}
          onDecide={onDecide}
        />
      ) : null}
    </View>
  );
}
