import { type ChatMessage, firstName } from '@buddy/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { ChatDraft } from '@/api/chat';
import {
  Avatar,
  CameraIcon,
  CloseIcon,
  ImagesIcon,
  PencilIcon,
  PlusIcon,
  PollIcon,
  PressableScale,
  ReplyIcon,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

export interface ChatPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ComposerProps {
  /** Until `me` loads, a send couldn't be attributed: keep the text. */
  ready: boolean;
  myId: string | undefined;
  /** Who can be @mentioned. */
  people: ChatPerson[];
  onSend: (draft: ChatDraft) => void;
  onTyping: () => void;
  /** Picks a photo and sends it with this caption; resolves true if one was sent. */
  onPhoto: (
    source: 'library' | 'camera',
    caption: string,
    mentions: ChatDraft['mentions'],
  ) => Promise<boolean>;
  onPoll: () => void;
  /** Your message being edited: its text fills the box, and Send saves it. */
  editing: ChatMessage | null;
  onCancelEdit: () => void;
  /** The message being replied to, shown above the box until sent or cancelled. */
  replyTo?: ChatDraft['replyTo'];
  onCancelReply: () => void;
}

const MAX_SUGGESTIONS = 5;

/** The "@na" being typed just before the cursor, if any. */
const mentionQuery = (before: string) => /(?:^|\s)@([^\s@]{0,20})$/u.exec(before)?.[1];

/**
 * The message box, with + for a photo or a poll, and @ to tag someone. Its
 * text lives here, so typing re-renders only this, not every message.
 */
export function Composer({
  ready,
  myId,
  people,
  onSend,
  onTyping,
  onPhoto,
  onPoll,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
}: ComposerProps) {
  const { bottom } = useScreenInsets();
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const [tagged, setTagged] = useState<ChatPerson[]>([]);
  // Set after tagging someone, to put the cursor after their name; released once it's there.
  const [selection, setSelection] = useState<{ start: number; end: number }>();
  const input = useRef<TextInput>(null);
  // Chose Reply: straight to typing.
  useEffect(() => {
    if (replyTo) input.current?.focus();
  }, [replyTo]);
  // Chose Edit: the message's text in the box, its tags kept (set while
  // rendering, the React way to follow a prop).
  const [editingId, setEditingId] = useState<string | null>(null);
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    if (editing) {
      setText(editing.body);
      setCursor(editing.body.length);
      setTagged(
        editing.mentions.map((m) => people.find((p) => p.id === m.id) ?? { ...m, avatarUrl: null }),
      );
    }
  }
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  const canSend = ready && !!text.trim();

  const query = mentionQuery(text.slice(0, cursor));
  const suggestions =
    query === undefined
      ? []
      : people
          .filter((p) => p.id !== myId)
          .filter((p) => {
            const q = query.toLowerCase();
            return (
              p.name.toLowerCase().startsWith(q) || firstName(p.name).toLowerCase().startsWith(q)
            );
          })
          .slice(0, MAX_SUGGESTIONS);

  /** People still tagged in the text as written. */
  const mentions = () =>
    tagged
      .filter((p) => text.includes(`@${firstName(p.name)}`))
      .map((p) => ({ id: p.id, name: p.name }));

  const tag = (person: ChatPerson) => {
    const before = text.slice(0, cursor).replace(/@[^\s@]*$/u, `@${firstName(person.name)} `);
    const next = before + text.slice(cursor);
    setText(next);
    setCursor(before.length);
    setSelection({ start: before.length, end: before.length });
    input.current?.focus();
    setTagged((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]));
  };

  const reset = () => {
    setText('');
    setCursor(0);
    setTagged([]);
  };

  const send = () => {
    if (!canSend) return;
    onSend({ body: text, mentions: mentions() });
    reset();
  };

  const [attach, setAttach] = useState(false);
  const photo = async (source: 'library' | 'camera') => {
    if (await onPhoto(source, text.trim(), mentions())) {
      reset();
      setAttach(false);
    }
  };

  return (
    <View className="border-t border-line">
      {editing ? (
        <View className="flex-row items-center gap-3 border-b border-line bg-surface px-[18px] py-2.5">
          <PencilIcon size={17} color={colors.lime} />
          <View className="min-w-0 flex-1 border-l-[3px] border-lime pl-2.5">
            <Text className="font-sans-semibold text-[13px] text-lime">Editing message</Text>
            <Text className="font-sans text-[13px] text-muted" numberOfLines={1}>
              {editing.body}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              onCancelEdit();
              reset();
            }}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-surface-raised"
          >
            <CloseIcon color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {replyTo && !editing ? (
        <View className="flex-row items-center gap-3 border-b border-line bg-surface px-[18px] py-2.5">
          <ReplyIcon size={18} color={colors.lime} />
          <View className="min-w-0 flex-1 border-l-[3px] border-lime pl-2.5">
            <Text className="font-sans-semibold text-[13px] text-lime" numberOfLines={1}>
              Replying to {replyTo.senderName ?? 'Deleted account'}
            </Text>
            <Text className="font-sans text-[13px] text-muted" numberOfLines={1}>
              {replyTo.summary}
            </Text>
          </View>
          <Pressable
            onPress={onCancelReply}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-surface-raised"
          >
            <CloseIcon color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {suggestions.length ? (
        <View className="border-b border-line bg-surface px-3.5 py-1.5">
          {suggestions.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => tag(p)}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${p.name}`}
              className="flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-surface-raised"
            >
              <Avatar uri={p.avatarUrl ?? undefined} name={p.name} size={30} />
              <Text className="font-sans-medium text-[15px] text-ink">{p.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        className="flex-row gap-2 px-3.5 pt-3"
        style={{ paddingBottom: attach ? 12 : bottom(28) }}
      >
        {editing ? null : (
          <PressableScale
            onPress={() => {
              // The panel takes the keyboard's place.
              if (!attach) Keyboard.dismiss();
              setAttach((a) => !a);
            }}
            scale="strong"
            accessibilityRole="button"
            accessibilityLabel={attach ? 'Close attachments' : 'Add a photo or a poll'}
            accessibilityState={{ expanded: attach }}
            className={cn(
              'h-[50px] w-[50px] items-center justify-center rounded-full',
              attach ? 'bg-surface-raised' : 'bg-surface',
            )}
          >
            {attach ? (
              <CloseIcon color={colors.ink} size={20} />
            ) : (
              <PlusIcon color={colors.ink} size={22} />
            )}
          </PressableScale>
        )}
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (t) onTyping();
          }}
          ref={input}
          onFocus={() => setAttach(false)}
          selection={selection}
          onSelectionChange={(e) => {
            setCursor(e.nativeEvent.selection.end);
            if (selection && e.nativeEvent.selection.end === selection.end) setSelection(undefined);
          }}
          onSubmitEditing={send}
          submitBehavior="submit"
          returnKeyType="send"
          placeholder="Message the group"
          placeholderTextColor={colors.subtle}
          selectionColor={colors.lime}
          className="h-[50px] min-w-0 flex-1 rounded-[25px] border border-field bg-surface px-5 font-sans text-[15.5px] text-ink"
        />
        <PressableScale
          onPress={send}
          disabled={!canSend}
          haptic="light"
          scale="strong"
          accessibilityRole="button"
          accessibilityLabel="Send"
          className={cn(
            'h-[50px] items-center justify-center rounded-[25px] px-5',
            canSend ? 'bg-lime' : 'bg-disabled',
          )}
        >
          <Text
            className={cn('font-sans-semibold text-[15px]', canSend ? 'text-bg' : 'text-muted')}
          >
            {editing ? 'Save' : 'Send'}
          </Text>
        </PressableScale>
      </View>

      {attach && !editing ? (
        // Style objects on the animated view: NativeWind doesn't style Reanimated views.
        <Animated.View
          entering={FadeInDown.duration(180)}
          style={[styles.panel, { paddingBottom: bottom(28) + 8 }]}
        >
          <AttachTile
            label="Gallery"
            hint="Your photos"
            icon={<ImagesIcon color={colors.lime} size={22} />}
            onPress={() => void photo('library')}
          />
          <AttachTile
            label="Camera"
            hint="Take a photo"
            icon={<CameraIcon color={colors.lime} size={22} />}
            onPress={() => void photo('camera')}
          />
          <AttachTile
            label="Poll"
            hint="Ask the group"
            icon={<PollIcon color={colors.lime} size={22} />}
            onPress={() => {
              setAttach(false);
              onPoll();
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** One choice in the attachment panel: a card like the app's other tiles. */
function AttachTile({
  label,
  hint,
  icon,
  onPress,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scale="dim"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      className="flex-1 rounded-[18px] bg-surface px-3.5 pb-3.5 pt-3"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-lime-deep">{icon}</View>
      <Text className="mt-3 font-sans-semibold text-[15px] text-ink">{label}</Text>
      <Text className="mt-0.5 font-sans text-[12.5px] text-muted" numberOfLines={1}>
        {hint}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 4,
  },
});
