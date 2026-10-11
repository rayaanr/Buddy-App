import { type ChatMessage, REACTIONS, type Reaction } from '@buddy/shared';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { popIn } from '@/theme/motion';

import { selectionHaptic } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { colors, shadows } from '@/theme';

export interface SelectedMessage {
  message: ChatMessage;
  mine: boolean;
  /** Where on screen it was long-pressed (y), to float the reactions beside it. */
  y: number;
  /** When it was long-pressed (whether it can still be edited is judged then). */
  at: number;
}

interface ReactionBarProps {
  selected: SelectedMessage;
  myId: string | undefined;
  /** Tapping anywhere else lets go of the message. */
  onDismiss: () => void;
  onReact: (messageId: string, emoji: Reaction | null) => void;
  /** Keeps the bar below the chat's header. */
  headerHeight: number;
}

const BAR_HEIGHT = 60;
const GAP = 44;

/**
 * Long-pressing a message: a row of reactions floats beside it (Reply and
 * Report move into the header, see ChatView). Rendered over the chat, not
 * in a modal, so the header stays usable.
 */
export function ReactionBar({
  selected,
  myId,
  onDismiss,
  onReact,
  headerHeight,
}: ReactionBarProps) {
  const { height } = useWindowDimensions();
  const { bottom } = useScreenInsets();
  const { message: m, mine } = selected;
  const current = m.reactions.find((r) => myId && r.userIds.includes(myId))?.emoji ?? null;

  // Above the finger if there's room under the header, else below it.
  const above = selected.y - BAR_HEIGHT - GAP;
  const top = Math.min(
    above > headerHeight + 8 ? above : selected.y + GAP / 2,
    height - bottom(28) - 90 - BAR_HEIGHT,
  );

  return (
    <View style={[StyleSheet.absoluteFill, { top: headerHeight }]} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityLabel="Close reactions"
      />
      <Animated.View
        entering={popIn}
        style={[styles.bar, { top: top - headerHeight }, mine ? styles.right : styles.left]}
        accessibilityRole="toolbar"
      >
        {REACTIONS.map((emoji) => {
          const picked = current === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => {
                selectionHaptic();
                onReact(m.id, picked ? null : emoji);
                onDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={picked ? `Remove ${emoji} reaction` : `React with ${emoji}`}
              className={cn(
                'h-12 w-12 items-center justify-center rounded-full active:bg-surface',
                picked && 'bg-lime-deep',
              )}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors['surface-raised'],
    boxShadow: shadows.raised,
  },
  left: { left: 12 },
  right: { right: 12 },
  emoji: { fontSize: 28 },
});
