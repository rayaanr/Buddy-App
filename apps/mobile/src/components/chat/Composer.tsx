import { firstName } from '@buddy/shared';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { ChatDraft } from '@/api/chat';
import { Avatar, CloseIcon, Menu, PlusIcon, PressableScale, ReplyIcon } from '@/components/ui';
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
  onPhoto: (caption: string, mentions: ChatDraft['mentions']) => Promise<boolean>;
  onPoll: () => void;
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

  const photo = async () => {
    if (await onPhoto(text.trim(), mentions())) reset();
  };

  return (
    <View className="border-t border-line">
      {replyTo ? (
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

      <View className="flex-row gap-2 px-3.5 pt-3" style={{ paddingBottom: bottom(28) }}>
        <Menu
          label="Add a photo or a poll"
          align="start"
          trigger={
            <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-surface">
              <PlusIcon color={colors.ink} size={22} />
            </View>
          }
          items={[
            { label: 'Photo', onPress: () => void photo() },
            { label: 'Poll', onPress: onPoll },
          ]}
        />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (t) onTyping();
          }}
          ref={input}
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
            Send
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}
