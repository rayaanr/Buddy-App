import type { ChatPoll } from '@buddy/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

interface PollCardProps {
  poll: ChatPoll;
  myId: string | undefined;
  /** Your picks; nothing clears your answer. Undefined while the poll is still sending. */
  onVote?: (optionIds: string[]) => void;
}

/**
 * A poll in the chat: tap an option to vote, tap it again to take it back.
 * Bars show how the votes split; everyone sees results as they come in.
 */
export function PollCard({ poll, myId, onVote }: PollCardProps) {
  const voters = new Set(poll.options.flatMap((o) => o.voterIds));
  const mine = poll.options.filter((o) => myId && o.voterIds.includes(myId)).map((o) => o.id);

  const choose = (id: string) => {
    if (!onVote) return;
    if (poll.multiple) onVote(mine.includes(id) ? mine.filter((m) => m !== id) : [...mine, id]);
    else onVote(mine.includes(id) ? [] : [id]);
  };

  return (
    <Card className="w-[272px] border border-line p-3.5">
      <Text className="font-mono-medium text-micro uppercase tracking-[1px] text-lime">Poll</Text>
      <Text className="mt-1 font-sans-semibold text-body leading-subhead text-ink">
        {poll.question}
      </Text>
      <Text className="mb-2.5 mt-0.5 font-sans text-footnote text-muted">
        {poll.multiple ? 'Pick any' : 'Pick one'} · {voters.size}{' '}
        {voters.size === 1 ? 'vote' : 'votes'}
      </Text>
      <View className="gap-2">
        {poll.options.map((o) => {
          const picked = mine.includes(o.id);
          const share = voters.size ? o.voterIds.length / voters.size : 0;
          return (
            <Pressable
              key={o.id}
              onPress={() => choose(o.id)}
              disabled={!onVote}
              role={poll.multiple ? 'checkbox' : 'radio'}
              aria-checked={picked}
              accessibilityLabel={`${o.text}, ${o.voterIds.length} ${o.voterIds.length === 1 ? 'vote' : 'votes'}`}
              className={cn(
                'min-h-[44px] flex-row items-center gap-2.5 overflow-hidden rounded-xl border px-3 active:opacity-80',
                picked ? 'border-lime' : 'border-field',
              )}
            >
              <View
                pointerEvents="none"
                style={[styles.bar, { width: `${Math.round(share * 100)}%` }]}
              />
              <View
                className={cn(
                  'h-5 w-5 items-center justify-center border-2',
                  poll.multiple ? 'rounded-md' : 'rounded-full',
                  picked ? 'border-lime bg-lime' : 'border-outline',
                )}
              >
                {picked ? <CheckIcon size={12} strokeWidth={3} /> : null}
              </View>
              <Text className="flex-1 py-2.5 font-sans-medium text-subhead text-ink">{o.text}</Text>
              <Text className="font-sans-semibold text-label text-muted">{o.voterIds.length}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors['lime-deep'],
  },
});
