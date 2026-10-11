import { type ChatMessage, REACTIONS, type Reaction } from '@buddy/shared';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { selectionHaptic } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

export interface MessageActionsTarget {
  message: ChatMessage;
  mine: boolean;
  /** Where on screen it was long-pressed (y), to open beside the message. */
  y: number;
}

interface MessageActionsProps {
  target: MessageActionsTarget | null;
  myId: string | undefined;
  onClose: () => void;
  onReact: (messageId: string, emoji: Reaction | null) => void;
  onReply: (message: ChatMessage) => void;
  /** Undefined hides Report (your own messages, deleted accounts). */
  onReport?: (message: ChatMessage) => void;
}

const CARD_HEIGHT = 170;
const GAP = 14;

/**
 * What long-pressing a message opens: a row of reactions, then Reply (and
 * Report, for other people's). A small popover beside the message, not a
 * drawer: it's a quick choice about that one message.
 */
export function MessageActions({
  target,
  myId,
  onClose,
  onReact,
  onReply,
  onReport,
}: MessageActionsProps) {
  const { height } = useWindowDimensions();
  const { top, bottom } = useScreenInsets();
  if (!target) return null;
  const { message: m, mine } = target;
  const current = m.reactions.find((r) => myId && r.userIds.includes(myId))?.emoji ?? null;

  // Above the finger if there's room, else below; always on screen.
  const above = target.y - CARD_HEIGHT - GAP;
  const y = Math.min(
    Math.max(above > top(56) ? above : target.y + GAP, top(56)),
    height - bottom(28) - CARD_HEIGHT,
  );

  const act = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Animated.View entering={FadeIn.duration(120)} style={styles.backdrop} />
      </Pressable>
      <Animated.View
        entering={ZoomIn.duration(150)}
        style={[styles.card, { top: y }, mine ? styles.right : styles.left]}
      >
        <View className="flex-row gap-1 px-2 py-2" accessibilityRole="toolbar">
          {REACTIONS.map((emoji) => {
            const picked = current === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() =>
                  act(() => {
                    selectionHaptic();
                    onReact(m.id, picked ? null : emoji);
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={picked ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                className={cn(
                  'h-11 w-11 items-center justify-center rounded-full active:bg-surface',
                  picked && 'bg-lime-deep',
                )}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
        <Item label="Reply" onPress={() => act(() => onReply(m))} />
        {onReport ? (
          <Item label="Report message" destructive onPress={() => act(() => onReport(m))} />
        ) : null}
      </Animated.View>
    </Modal>
  );
}

function Item({
  label,
  destructive,
  onPress,
}: {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Text
        className={cn('font-sans-medium text-[15.5px]', destructive ? 'text-danger' : 'text-ink')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  card: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors['surface-raised'],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  left: { left: 18 },
  right: { right: 18 },
  emoji: { fontSize: 24 },
  item: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  pressed: { backgroundColor: colors.surface },
});
