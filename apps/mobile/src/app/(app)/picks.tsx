import { firstName, type Interest, type Pick } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, usePicks, useUpdateMe } from '@/api/queries';
import { SwipeDeck } from '@/components/picks/SwipeDeck';
import { CloseIcon, EmptyState, Heading, Loading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';

/**
 * "Picked for you": Tinder-style deck shown to returning users, and from the
 * sparkles button on Discover (`?from=button`) any time.
 */
export default function PicksScreen() {
  const { top } = useScreenInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const me = useMe();
  const picks = usePicks();

  // Freeze the deck once loaded so cards don't reshuffle while swiping
  // (set during render: React's pattern for state derived from props/queries).
  const [deck, setDeck] = useState<Pick[] | null>(picks.data ?? null);
  const [index, setIndex] = useState(0);
  if (!deck && picks.data) setDeck(picks.data);
  // Couldn't load a deck: nothing to show. (Once loaded it's frozen, so a
  // failed background refetch mid-swipe must not close it.)
  useEffect(() => {
    if (!deck && picks.error) router.back();
  }, [deck, picks.error]);

  // Kinds marked "Not into" this time: the rest of the deck skips them too
  // (unless they're from a community you're in, like the server does).
  const [notInto, setNotInto] = useState<Interest[]>([]);
  const update = useUpdateMe();
  const skipped = (p: Pick) =>
    !!p.activity.interest && notInto.includes(p.activity.interest) && !p.fromYourCommunity;
  const after = (i: number) => {
    let n = i + 1;
    while (deck?.[n] && skipped(deck[n]!)) n++;
    return n;
  };
  const card = deck?.[index];
  const next = deck?.[after(index)];

  const onDecide = (like: boolean) => {
    if (!deck || !card) return;
    if (like) {
      // First "yes" closes the deck and opens that activity.
      router.replace(`/activity/${card.activity.id}`);
      return;
    }
    const n = after(index);
    if (n >= deck.length) {
      router.back();
      toast('You’re all caught up.');
      return;
    }
    setIndex(n);
  };

  /** No more of this kind in picks, and it's no longer one of your interests. */
  const hideKind = (kind: Interest) => {
    if (!me.data) return;
    setNotInto((list) => [...list, kind]);
    update.mutate(
      {
        hiddenInterests: [...new Set([...me.data.hiddenInterests, kind])],
        interests: me.data.interests.filter((i) => i !== kind),
      },
      {
        onSuccess: () =>
          toast(`No more ${kind.toLowerCase()} in your picks. Change it in Edit profile.`),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <View
        className="flex-row items-start justify-between px-edge"
        style={{ paddingTop: top(60) }}
      >
        <View className="flex-1">
          <Text className="font-mono-medium text-caption tracking-[1.44px] text-lime">
            PICKED FOR YOU{deck ? ` · ${Math.min(index + 1, deck.length)} OF ${deck.length}` : ''}
          </Text>
          <Heading size="section" className="mt-2">
            {from === 'button'
              ? 'Worth a look'
              : `Welcome back${me.data ? `, ${firstName(me.data.name)}` : ''}`}
          </Heading>
          <Text className="mt-1.5 font-sans text-subhead text-muted">
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
          onNotInto={
            card.activity.interest && !card.fromYourCommunity
              ? () => hideKind(card.activity.interest!)
              : undefined
          }
        />
      ) : null}
      {deck && !deck.length ? (
        <View className="flex-1 justify-center px-edge">
          <EmptyState
            card
            title="Nothing new right now"
            subtitle="New activities near you that match what you’re into will show up here."
            cta="Back to Discover"
            onPress={() => router.back()}
          />
        </View>
      ) : null}
    </View>
  );
}
