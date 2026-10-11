import { type ChatMessage, isDeletedAccount, messageSummary, type Reaction } from '@buddy/shared';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import { FlatList, Platform, StyleSheet, Text, View, type ListRenderItem } from 'react-native';

import { type ChatDraft, type ChatRoom, useChat } from '@/api/chat';
import { ApiRequestError, errorMessage } from '@/api/client';
import { keys, useMe } from '@/api/queries';
import {
  AnimatedView,
  BackButton,
  KeyboardScreen,
  LoadError,
  Loading,
  PressableScale,
} from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';
import { enterMessage } from '@/theme/motion';
import { type ChatPerson, Composer } from './Composer';
import { MessageActions, type MessageActionsTarget } from './MessageActions';
import { MessageBubble, toChatRows, type ChatRow } from './MessageBubble';
import { PhotoViewer } from './PhotoViewer';
import { TypingIndicator } from './TypingIndicator';

/**
 * New messages slide in on phones. Not on web: there, the animation takes the
 * row out of the (inverted) list's layout once it ends, and the next message
 * overlaps it.
 */
const animateNew = Platform.OS !== 'web';

interface ChatViewProps {
  room: ChatRoom;
  title: string;
  subtitle: string;
  /** Shown above the first message, e.g. when and where the activity is. */
  banner?: ReactElement | null;
  /** What someone who isn't a member sees instead. */
  membersOnly: string;
  /** Tapping the title, e.g. back to the activity. */
  onTitlePress?: () => void;
  /** Who can be @mentioned. */
  people: ChatPerson[];
}

/** A group chat screen: an activity's or a community's. */
export function ChatView({
  room,
  title,
  subtitle,
  banner,
  membersOnly,
  onTitlePress,
  people,
}: ChatViewProps) {
  const me = useMe();
  const chat = useChat(room, me.data?.id);
  const { top } = useScreenInsets();
  const qc = useQueryClient();
  // Leaving the chat: its unread count on the Chats list is now out of date.
  useEffect(() => () => void qc.invalidateQueries({ queryKey: keys.chats }), [qc]);

  // Newest first: the list is inverted, so the latest message sits at the
  // bottom and stays there as messages arrive, without scrolling by hand.
  const rows = useMemo(() => toChatRows(chat.items).reverse(), [chat.items]);

  // Messages already here when the chat opened appear as-is; new ones animate in.
  const [openedWith, setOpenedWith] = useState<Set<string> | null>(null);
  if (openedWith === null && !chat.isLoading && !chat.error) {
    setOpenedWith(new Set(chat.items.map((i) => i.message.id)));
  }

  const reportMessage = useCallback(
    (m: ChatMessage) =>
      router.push({ pathname: '/report', params: { type: 'message', id: m.id, chatId: room.id } }),
    [room.id],
  );
  const [viewing, setViewing] = useState<string | null>(null);
  const [actions, setActions] = useState<MessageActionsTarget | null>(null);
  const [replyTo, setReplyTo] = useState<ChatDraft['replyTo']>();
  // A quoted message just jumped to, briefly lit up.
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const list = useRef<FlatList<ChatRow>>(null);
  const { retry, vote, react, send } = chat;
  const onVote = useCallback(
    (messageId: string, optionIds: string[]) =>
      void vote(messageId, optionIds).catch((err: unknown) => toast(errorMessage(err))),
    [vote],
  );
  const onReact = useCallback(
    (messageId: string, emoji: Reaction | null) =>
      void react(messageId, emoji).catch((err: unknown) => toast(errorMessage(err))),
    [react],
  );
  const onActions = useCallback(
    (message: ChatMessage, mine: boolean, y: number) => setActions({ message, mine, y }),
    [],
  );
  const onReply = useCallback(
    (m: ChatMessage) =>
      setReplyTo({
        id: m.id,
        senderName: m.sender?.name ?? null,
        summary: messageSummary({
          body: m.body,
          hasImage: !!m.image || m.photoExpired,
          pollQuestion: m.poll?.question,
        }),
      }),
    [],
  );
  // Read by onJumpTo, which stays the same function so rows don't re-render.
  const rowsRef = useRef(rows);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const onJumpTo = useCallback((messageId: string) => {
    const index = rowsRef.current.findIndex((r) => r.message.id === messageId);
    if (index < 0) return toast('That message is no longer in the chat.');
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setHighlighted(messageId);
    setTimeout(() => setHighlighted((h) => (h === messageId ? null : h)), 1400);
  }, []);
  const myId = me.data?.id;
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item }) => (
      <AnimatedView
        entering={
          animateNew && openedWith && !openedWith.has(item.message.id) ? enterMessage : undefined
        }
        style={item.message.id === highlighted ? styles.highlight : undefined}
      >
        <MessageBubble
          row={item}
          myId={myId}
          onRetry={retry}
          onVote={onVote}
          onOpenPhoto={setViewing}
          onActions={onActions}
          onReact={onReact}
          onReply={onReply}
          onJumpTo={onJumpTo}
        />
      </AnimatedView>
    ),
    [openedWith, highlighted, myId, retry, onVote, onActions, onReact, onReply, onJumpTo],
  );

  /** Picks a photo from the library and sends it, with the typed text as its caption. */
  const sendPhoto = async (caption: string, mentions: ChatDraft['mentions']) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return false;
    send({
      body: caption,
      mentions,
      replyTo,
      photo: {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType,
      },
    });
    setReplyTo(undefined);
    return true;
  };

  const status = chat.error instanceof ApiRequestError ? chat.error.status : null;
  if (status === 403) return <NotFound message={membersOnly} />;
  if (status === 404) return <NotFound message="This chat is no longer available." />;

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <View
        className="flex-row items-center gap-3.5 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: top(56) }}
      >
        <BackButton />
        <PressableScale
          onPress={onTitlePress}
          disabled={!onTitlePress}
          scale="dim"
          className="min-w-0 flex-1"
        >
          <Text className="font-sans-semibold text-[16.5px] text-ink" numberOfLines={1}>
            {title}
          </Text>
          <Text className="mt-0.5 font-sans text-[13px] text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </PressableScale>
      </View>

      {chat.isLoading ? (
        <Loading className="flex-1" />
      ) : chat.error ? (
        <View className="flex-1 justify-center px-[18px]">
          <LoadError error={chat.error} onRetry={() => void chat.refetch()} />
        </View>
      ) : (
        <FlatList
          ref={list}
          inverted
          data={rows}
          keyExtractor={(r) => r.message.id}
          renderItem={renderItem}
          // Inverted: paddingTop is the visual bottom.
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 14,
            gap: 6,
          }}
          // Reading older messages: new ones don't yank the view down. Near
          // the bottom: it follows the conversation.
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 80 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          // Inverted: the header shows at the bottom, the footer at the top.
          ListHeaderComponent={chat.typingName ? <TypingIndicator name={chat.typingName} /> : null}
          ListFooterComponent={banner ?? null}
          // Jumping to a quote far up: get near it, then try again once it's laid out.
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            setTimeout(
              () => list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }),
              120,
            );
          }}
        />
      )}

      <Composer
        ready={!!me.data}
        myId={me.data?.id}
        people={people}
        onSend={(draft) => {
          send({ ...draft, replyTo });
          setReplyTo(undefined);
        }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        onTyping={chat.notifyTyping}
        onPhoto={sendPhoto}
        onPoll={() =>
          router.push({ pathname: '/new-poll', params: { kind: room.kind, id: room.id } })
        }
      />
      <PhotoViewer url={viewing} onClose={() => setViewing(null)} />
      <MessageActions
        target={actions}
        myId={myId}
        onClose={() => setActions(null)}
        onReact={onReact}
        onReply={onReply}
        onReport={
          actions &&
          !actions.mine &&
          actions.message.sender &&
          !isDeletedAccount(actions.message.sender)
            ? reportMessage
            : undefined
        }
      />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  // A quoted message you jumped to.
  highlight: { backgroundColor: 'rgba(201,245,63,0.12)', borderRadius: 14 },
});
