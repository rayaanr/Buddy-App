import {
  type ChatMessage,
  isDeletedAccount,
  LIMITS,
  messageSummary,
  type Reaction,
} from '@buddy/shared';
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
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  BackHandler,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';

import { type ChatDraft, type ChatRoom, useChat } from '@/api/chat';
import { ApiRequestError, errorMessage } from '@/api/client';
import { keys, useMe } from '@/api/queries';
import {
  AnimatedView,
  BackButton,
  ArrowDownIcon,
  Avatar,
  CloseIcon,
  ConfirmDialog,
  CopyIcon,
  holdHaptic,
  IconButton,
  KeyboardScreen,
  LoadError,
  MutedIcon,
  Loading,
  Menu,
  PencilIcon,
  PressableScale,
  ReplyIcon,
  TrashIcon,
} from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';
import { colors } from '@/theme';
import { enterMessage } from '@/theme/motion';
import { type ChatPerson, Composer } from './Composer';
import { ReactionBar, type SelectedMessage } from './ReactionBar';
import { MessageBubble, toChatRows, type ChatRow } from './MessageBubble';
import { PhotoViewer } from './PhotoViewer';
import { TypingIndicator } from './TypingIndicator';
import { useToggleMute } from './useToggleMute';

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
  /** Tapping the title: the activity's or community's page. */
  onTitlePress?: () => void;
  /** The activity's cover or the community's logo, beside the title. */
  image?: string | null;
  /** Who can be @mentioned. */
  people: ChatPerson[];
  /** Whether you've muted it; unset when you aren't in it (nothing to mute). */
  muted?: boolean;
}

/** A group chat screen: an activity's or a community's. */
export function ChatView({
  room,
  title,
  subtitle,
  banner,
  membersOnly,
  onTitlePress,
  image,
  people,
  muted,
}: ChatViewProps) {
  const toggleMute = useToggleMute();
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
  // Long-pressed: highlighted, reactions float beside it, and the header
  // turns into its actions (Reply, Report), like WhatsApp.
  const [selected, setSelected] = useState<SelectedMessage | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    if (!selected || Platform.OS !== 'android') return;
    // Android back lets go of the message instead of leaving the chat.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [selected]);
  const [replyTo, setReplyTo] = useState<ChatDraft['replyTo']>();
  // Your message being edited in the box, and the one about to be deleted.
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  // A quoted message just jumped to, briefly lit up.
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const list = useRef<FlatList<ChatRow>>(null);
  // Scrolled up a way: a ↓ button jumps back to the newest message.
  const [showJump, setShowJump] = useState(false);
  // Where "new messages" starts, fixed when the chat opens (reading it doesn't move it).
  const [unread, setUnread] = useState<{ from: string; count: number } | null | undefined>();
  if (unread === undefined && !chat.isLoading && !chat.error) {
    const since = chat.myReadUpTo;
    const fresh = since
      ? chat.items.filter(
          (i) => !i.mine && i.message.kind === 'user' && i.message.createdAt > since,
        )
      : [];
    setUnread(fresh.length ? { from: fresh[0]!.message.id, count: fresh.length } : null);
  }
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
  const onActions = useCallback((message: ChatMessage, mine: boolean, y: number) => {
    holdHaptic();
    setSelected({ message, mine, y, at: Date.now() });
  }, []);
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
  const selectedId = selected?.message.id ?? null;
  const selectedSender = selected?.message.sender;
  const canReport =
    !!selected && !selected.mine && !!selectedSender && !isDeletedAccount(selectedSender);
  // Your text (or caption) for a few minutes after sending; polls stay as they are.
  const canEdit =
    !!selected &&
    selected.mine &&
    !!selected.message.body &&
    !selected.message.poll &&
    selected.at - new Date(selected.message.createdAt).getTime() <
      LIMITS.messageEditMinutes * 60_000;
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item }) => (
      <AnimatedView
        entering={
          animateNew && openedWith && !openedWith.has(item.message.id) ? enterMessage : undefined
        }
        style={
          item.message.id === highlighted || item.message.id === selectedId
            ? styles.highlight
            : undefined
        }
      >
        {unread?.from === item.message.id ? <NewMessages count={unread.count} /> : null}
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
    [
      openedWith,
      unread,
      highlighted,
      selectedId,
      myId,
      retry,
      onVote,
      onActions,
      onReact,
      onReply,
      onJumpTo,
    ],
  );

  /** Picks a photo (library or camera) and sends it, with the typed text as its caption. */
  const sendPhoto = async (
    source: 'library' | 'camera',
    caption: string,
    mentions: ChatDraft['mentions'],
  ) => {
    if (source === 'camera') {
      const allowed = await ImagePicker.requestCameraPermissionsAsync();
      if (!allowed.granted) {
        toast('Allow camera access in Settings to take photos for chats.');
        return false;
      }
    }
    const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.8 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
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
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {selected ? (
          <>
            <IconButton
              icon={<CloseIcon />}
              label="Done with this message"
              onPress={() => setSelected(null)}
            />
            <View className="flex-1" />
            {selected.message.body ? (
              <IconButton
                icon={<CopyIcon />}
                label="Copy text"
                onPress={() => {
                  void Clipboard.setStringAsync(selected.message.body).then(() => toast('Copied.'));
                  setSelected(null);
                }}
              />
            ) : null}
            {canEdit ? (
              <IconButton
                icon={<PencilIcon size={18} color={colors.ink} />}
                label="Edit message"
                onPress={() => {
                  setEditing(selected.message);
                  setReplyTo(undefined);
                  setSelected(null);
                }}
              />
            ) : null}
            {selected.mine ? (
              <IconButton
                icon={<TrashIcon />}
                label="Delete message"
                onPress={() => {
                  setDeleting(selected.message);
                  setSelected(null);
                }}
              />
            ) : null}
            <IconButton
              icon={<ReplyIcon />}
              label="Reply"
              onPress={() => {
                onReply(selected.message);
                setSelected(null);
              }}
            />
            {canReport ? (
              <Menu
                label="More options"
                items={[
                  {
                    label: 'Report message',
                    destructive: true,
                    onPress: () => {
                      reportMessage(selected.message);
                      setSelected(null);
                    },
                  },
                ]}
              />
            ) : null}
          </>
        ) : (
          <>
            <BackButton />
            <PressableScale
              onPress={onTitlePress}
              disabled={!onTitlePress}
              scale="dim"
              accessibilityRole={onTitlePress ? 'button' : undefined}
              accessibilityHint={onTitlePress ? 'Opens its details' : undefined}
              className="min-w-0 flex-1 flex-row items-center gap-3"
            >
              {title ? (
                <Avatar uri={image ?? undefined} name={title} size={40} shape="rounded" />
              ) : null}
              <View className="min-w-0 flex-1">
                <Text className="font-sans-semibold text-[16.5px] text-ink" numberOfLines={1}>
                  {title}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  {muted ? <MutedIcon size={13} accessibilityLabel="Muted" /> : null}
                  <Text className="flex-1 font-sans text-[13px] text-muted" numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
              </View>
            </PressableScale>
            {muted === undefined ? null : (
              <Menu
                label="Chat options"
                items={[
                  {
                    label: muted ? 'Unmute group chat' : 'Mute group chat',
                    onPress: () => toggleMute(room, !muted),
                  },
                ]}
              />
            )}
          </>
        )}
      </View>

      {chat.isLoading ? (
        <Loading className="flex-1" />
      ) : chat.error ? (
        <View className="flex-1 justify-center px-[18px]">
          <LoadError error={chat.error} onRetry={() => void chat.refetch()} />
        </View>
      ) : (
        <View className="flex-1">
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
            ListHeaderComponent={
              chat.typingName ? <TypingIndicator name={chat.typingName} /> : null
            }
            // Inverted: the "end" is the top, where older messages are.
            onEndReached={() => void chat.loadEarlier()}
            onEndReachedThreshold={0.4}
            onScroll={(e) => setShowJump(e.nativeEvent.contentOffset.y > 600)}
            scrollEventThrottle={100}
            ListFooterComponent={
              <>
                {chat.loadingEarlier ? <Loading className="py-3" /> : null}
                {chat.hasMore ? null : (banner ?? null)}
              </>
            }
            // Jumping to a quote far up: get near it, then try again once it's laid out.
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
              setTimeout(
                () => list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }),
                120,
              );
            }}
          />
          {showJump ? (
            <View style={styles.jump}>
              <IconButton
                icon={<ArrowDownIcon />}
                label="Jump to the latest messages"
                onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
                className="border border-line"
              />
            </View>
          ) : null}
        </View>
      )}

      <Composer
        ready={!!me.data}
        myId={me.data?.id}
        people={people}
        onSend={(draft) => {
          if (editing) {
            const id = editing.id;
            setEditing(null);
            void chat
              .edit(id, draft.body, draft.mentions?.map((m) => m.id) ?? [])
              .catch((err: unknown) => toast(errorMessage(err)));
            return;
          }
          send({ ...draft, replyTo });
          setReplyTo(undefined);
        }}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        onTyping={chat.notifyTyping}
        onPhoto={sendPhoto}
        onPoll={() =>
          router.push({ pathname: '/new-poll', params: { kind: room.kind, id: room.id } })
        }
      />
      <PhotoViewer url={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this message?"
        message="It’s replaced by “This message was deleted” for everyone."
        actions={[
          {
            label: 'Delete',
            destructive: true,
            onPress: () => {
              const id = deleting!.id;
              void chat.remove(id).catch((err: unknown) => toast(errorMessage(err)));
            },
          },
        ]}
      />
      {selected ? (
        <ReactionBar
          selected={selected}
          myId={myId}
          headerHeight={headerHeight}
          onDismiss={() => setSelected(null)}
          onReact={onReact}
        />
      ) : null}
    </KeyboardScreen>
  );
}

/** The line above the first message that arrived since you last read the chat. */
function NewMessages({ count }: { count: number }) {
  return (
    <View className="my-2 flex-row items-center gap-3" accessibilityRole="header">
      <View className="h-px flex-1 bg-lime/30" />
      <Text className="font-sans-semibold text-[12.5px] text-lime">
        {count === 1 ? '1 new message' : `${count} new messages`}
      </Text>
      <View className="h-px flex-1 bg-lime/30" />
    </View>
  );
}

const styles = StyleSheet.create({
  jump: { position: 'absolute', right: 16, bottom: 12 },
  // A message you long-pressed, or a quoted one you jumped to.
  // Full width, past the list's side padding.
  highlight: {
    backgroundColor: 'rgba(201,245,63,0.12)',
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
});
