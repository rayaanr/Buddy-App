import {
  serverEvent,
  type ChatMessage,
  type ChatPoll,
  type ChatPreview,
  type MessagesPage,
  type PollInput,
  type Reaction,
} from '@buddy/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { merge, refreshed } from '@/lib/chatPages';
import { API_URL } from '@/config';
import { sessionCookie } from './auth-client';
import { api, unwrap } from './client';
import { askForPush } from './push';
import { uploadSized } from './upload';
import { keys } from './queries';

export type MessageStatus = 'sending' | 'failed' | 'sent' | 'seen';

/** A message as the chat screen shows it: confirmed or still on its way. */
export interface ChatItem {
  message: ChatMessage;
  mine: boolean;
  status: MessageStatus | null;
}

/** What the composer sends: text, a photo (text is its caption) or a poll. */
export interface ChatDraft {
  body: string;
  /** People tagged as @FirstName in the text. */
  mentions?: { id: string; name: string }[];
  photo?: { uri: string; width: number; height: number; mimeType?: string | null };
  poll?: PollInput;
  /** The message this replies to, as it's quoted. */
  replyTo?: NonNullable<ChatMessage['replyTo']>;
}

/** A message on its way: shown at once, retried with the same id if it fails. */
interface Pending {
  message: ChatMessage;
  failed: boolean;
  draft: ChatDraft;
  /** The photo, once uploaded. */
  uploaded?: { key: string; width: number; height: number };
}

const TYPING_SHOW_MS = 3_000;
const TYPING_SEND_EVERY_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * React Native's WebSocket accepts request headers (used for the session
 * cookie); the DOM typings in scope only know the two-argument browser form.
 */
const NativeWebSocket = WebSocket as unknown as new (
  url: string,
  protocols?: string | string[],
  options?: { headers: Record<string, string> },
) => WebSocket;

/** A group chat: an activity's (everyone going) or a community's (its members). */
export interface ChatRoom {
  kind: 'activity' | 'community';
  id: string;
}

const wsUrl = ({ kind, id }: ChatRoom) =>
  `${API_URL.replace(/^http/, 'ws')}/v1/${kind === 'activity' ? 'activities' : 'communities'}/${id}/chat/ws`;

/** The chat's HTTP endpoints (the same for both kinds). */
const endpoints = ({ kind }: ChatRoom) =>
  kind === 'activity' ? api.activities[':id'].chat : api.communities[':id'].chat;

/** Inserts or replaces messages by id, keeping oldest-first order. */
/**
 * Live group chat for an activity or a community: history over HTTP, live events over a
 * WebSocket (with reconnect and catch-up), optimistic sends with retry,
 * typing indicators and read receipts.
 */
export function useChat(room: ChatRoom, myId: string | undefined) {
  const qc = useQueryClient();
  const roomId = room.id;
  const key = keys.messages(roomId);
  const chat = endpoints(room);
  const history = useQuery({
    queryKey: key,
    queryFn: async () =>
      refreshed(
        qc.getQueryData<MessagesPage>(key),
        await unwrap(chat.messages.$get({ param: { id: roomId }, query: {} })),
      ),
  });

  const [pending, setPending] = useState<Map<string, Pending>>(new Map());
  // Unsent messages survive closing the app: saved per chat, sent again on return.
  const savedKey = `buddy.unsent.${roomId}`;
  const restored = useRef(false);
  const [typing, setTyping] = useState<{ name: string; until: number } | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const lastTypingSent = useRef(0);
  // Read by socket handlers; a ref so `me` loading doesn't reconnect the socket.
  const myIdRef = useRef(myId);
  useLayoutEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  const update = useCallback(
    (fn: (page: MessagesPage) => MessagesPage) =>
      qc.setQueryData<MessagesPage>(key, (page) => (page ? fn(page) : page)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, roomId],
  );

  // ── Live connection ──────────────────────────────────────────────────
  useEffect(() => {
    let closedByUs = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    /** Fetches whatever arrived while we were disconnected. */
    const catchUp = async () => {
      const page = qc.getQueryData<MessagesPage>(key);
      const after = page?.messages.at(-1)?.id;
      if (!after) return void qc.invalidateQueries({ queryKey: key });
      const missed = await unwrap(
        chat.messages.$get({ param: { id: roomId }, query: { after } }),
      ).catch(() => null);
      if (missed) {
        update((p) => ({
          ...p,
          messages: merge(p.messages, missed.messages),
          othersReadUpTo: missed.othersReadUpTo ?? p.othersReadUpTo,
        }));
      }
    };

    const connect = async () => {
      const cookie = await sessionCookie();
      if (closedByUs) return;
      const ws = new NativeWebSocket(wsUrl(room), undefined, {
        headers: cookie ? { cookie } : {},
      });
      socket.current = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        attempt = 0;
        void catchUp();
      };
      ws.onmessage = (e) => {
        let data: unknown;
        try {
          data = JSON.parse(String(e.data));
        } catch {
          return;
        }
        const parsed = serverEvent.safeParse(data);
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type === 'message') {
          update((p) => ({ ...p, messages: merge(p.messages, [event.message]) }));
          setPending((prev) => {
            if (!prev.has(event.message.id)) return prev;
            const next = new Map(prev);
            next.delete(event.message.id);
            return next;
          });
          if (event.message.sender?.id && event.message.sender.id !== myIdRef.current) {
            setTyping(null);
          }
        } else if (event.type === 'typing') {
          setTyping({ name: event.user.name.split(' ')[0]!, until: Date.now() + TYPING_SHOW_MS });
        } else if (event.type === 'updated') {
          // Edited or deleted by its sender.
          update((p) => ({ ...p, messages: merge(p.messages, [event.message]) }));
        } else if (event.type === 'reactions') {
          update((p) => ({
            ...p,
            messages: p.messages.map((m) =>
              m.id === event.messageId ? { ...m, reactions: event.reactions } : m,
            ),
          }));
        } else if (event.type === 'poll') {
          update((p) => ({
            ...p,
            messages: p.messages.map((m) =>
              m.id === event.messageId ? { ...m, poll: event.poll } : m,
            ),
          }));
        } else if (event.type === 'removed') {
          // A moderator took it down.
          update((p) => ({
            ...p,
            messages: p.messages.filter((m) => m.id !== event.messageId),
          }));
        } else if (event.type === 'read') {
          update((p) => ({
            ...p,
            othersReadUpTo:
              !p.othersReadUpTo || event.upTo > p.othersReadUpTo ? event.upTo : p.othersReadUpTo,
          }));
        }
      };
      ws.onclose = (e) => {
        socket.current = null;
        // 4403: removed from the activity; don't keep knocking.
        if (closedByUs || e.code === 4403) return;
        // Refused twice before opening: maybe the session expired (the socket
        // can't say why). Checking who's signed in signs out on a 401.
        if (!opened && attempt >= 1) void qc.invalidateQueries({ queryKey: keys.me });
        // Jittered, so a server restart isn't met by every phone at once.
        const delay =
          Math.min(RECONNECT_MAX_MS, 1000 * 2 ** attempt++) * (0.75 + Math.random() / 2);
        retryTimer = setTimeout(() => void connect(), delay);
      };
    };

    const disconnect = () => {
      clearTimeout(retryTimer);
      socket.current?.close();
      socket.current = null;
    };

    void connect();

    // Phones drop sockets in the background; reconnect (and catch up) on return.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !socket.current) {
        // A reconnect may already be waiting: one socket, not two.
        clearTimeout(retryTimer);
        closedByUs = false;
        attempt = 0;
        void connect();
      } else if (state === 'background') {
        closedByUs = true;
        disconnect();
      }
    });

    return () => {
      closedByUs = true;
      sub.remove();
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Hide "is typing…" after a few seconds without a new signal.
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTyping(null), Math.max(0, typing.until - Date.now()));
    return () => clearTimeout(t);
  }, [typing]);

  // ── Read receipts ────────────────────────────────────────────────────
  const latestFromOthers = useMemo(
    () =>
      [...(history.data?.messages ?? [])].reverse().find((m) => m.sender && m.sender.id !== myId),
    [history.data, myId],
  );
  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    const id = latestFromOthers?.id;
    if (!id || id === lastMarked.current) return;
    lastMarked.current = id;
    void unwrap(chat.read.$post({ param: { id: roomId }, json: { messageId: id } }))
      // Read: clear its unread count (Chats list, badges) straight away.
      .then(() =>
        qc.setQueryData<ChatPreview[]>(keys.chats, (list) =>
          list?.map((c) => (c.id === roomId ? { ...c, unread: 0 } : c)),
        ),
      )
      .catch(() => {
        lastMarked.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, latestFromOthers?.id]);

  // ── Sending ──────────────────────────────────────────────────────────
  /** Uploads the photo (once) then posts; on failure the message stays, marked to retry. */
  const post = useCallback(
    async (item: Pending) => {
      const id = item.message.id;
      const { draft } = item;
      try {
        let photo = item.uploaded;
        if (draft.photo && !photo) {
          photo = await uploadSized('chat', draft.photo);
          // Kept, so a retry doesn't upload it again.
          const uploaded = photo;
          setPending((prev) => {
            const now = prev.get(id);
            return now ? new Map(prev).set(id, { ...now, uploaded }) : prev;
          });
        }
        const message = await unwrap(
          chat.messages.$post({
            param: { id: roomId },
            json: {
              id,
              body: draft.body,
              mentions: draft.mentions?.map((m) => m.id) ?? [],
              ...(photo && {
                imageKey: photo.key,
                imageWidth: photo.width,
                imageHeight: photo.height,
              }),
              ...(draft.poll && { poll: draft.poll }),
              ...(draft.replyTo && { replyToId: draft.replyTo.id }),
            },
          }),
        );
        update((p) => ({ ...p, messages: merge(p.messages, [message]) }));
        setPending((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        // Replies arrive as notifications: a good moment to ask.
        void askForPush();
      } catch {
        setPending((prev) => {
          const now = prev.get(id);
          if (!now) return prev;
          return new Map(prev).set(id, { ...now, failed: true });
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, update],
  );

  /** Sends text, a photo (the text is its caption) or a poll; it shows straight away. */
  const send = useCallback(
    (draft: ChatDraft) => {
      const body = draft.body.trim();
      if ((!body && !draft.photo && !draft.poll) || !myId) return;
      const id = randomUUID();
      const message: ChatMessage = {
        id,
        activityId: room.kind === 'activity' ? roomId : null,
        communityId: room.kind === 'community' ? roomId : null,
        kind: 'user',
        sender: { id: myId, name: '', avatarUrl: null },
        body,
        image: draft.photo
          ? { url: draft.photo.uri, width: draft.photo.width, height: draft.photo.height }
          : null,
        photoExpired: false,
        mentions: draft.mentions ?? [],
        poll: draft.poll
          ? {
              question: draft.poll.question,
              multiple: draft.poll.multiple,
              options: draft.poll.options.map((text, k) => ({
                id: `o${k + 1}`,
                text,
                voterIds: [],
              })),
            }
          : null,
        replyTo: draft.replyTo ?? null,
        reactions: [],
        editedAt: null,
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      const item: Pending = { message, failed: false, draft: { ...draft, body } };
      setPending((prev) => new Map(prev).set(id, item));
      void post(item);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, myId, post],
  );

  // Bring back what hadn't gone through last time, and try it again.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(savedKey)
      .then((raw) => {
        if (cancelled || !raw) return;
        const items = JSON.parse(raw) as Pending[];
        setPending((prev) => {
          const next = new Map(prev);
          for (const item of items) next.set(item.message.id, { ...item, failed: false });
          return next;
        });
        for (const item of items) void post({ ...item, failed: false });
      })
      .catch(() => {})
      .finally(() => {
        restored.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);
  useEffect(() => {
    if (!restored.current) return;
    const items = [...pending.values()];
    void (
      items.length
        ? AsyncStorage.setItem(savedKey, JSON.stringify(items))
        : AsyncStorage.removeItem(savedKey)
    ).catch(() => {});
  }, [pending, savedKey]);

  /** Same id as the first attempt, so the server never stores it twice. */
  const retry = useCallback(
    (id: string) => {
      const item = pending.get(id);
      if (!item) return;
      setPending((prev) => new Map(prev).set(id, { ...item, failed: false }));
      void post(item);
    },
    [pending, post],
  );

  /** Answers a poll (or changes or clears your answer); shows straight away. */
  const vote = useCallback(
    async (messageId: string, optionIds: string[]) => {
      if (!myId) return;
      const setPoll = (fn: (poll: ChatPoll) => ChatPoll) =>
        update((p) => ({
          ...p,
          messages: p.messages.map((m) =>
            m.id === messageId && m.poll ? { ...m, poll: fn(m.poll) } : m,
          ),
        }));
      setPoll((poll) => ({
        ...poll,
        options: poll.options.map((o) => ({
          ...o,
          voterIds: [
            ...o.voterIds.filter((v) => v !== myId),
            ...(optionIds.includes(o.id) ? [myId] : []),
          ],
        })),
      }));
      try {
        const message = await unwrap(
          chat.messages[':messageId'].vote.$post({
            param: { id: roomId, messageId },
            json: { optionIds },
          }),
        );
        setPoll(() => message.poll!);
      } catch (err) {
        void qc.invalidateQueries({ queryKey: key });
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, myId, update],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_SEND_EVERY_MS) return;
    lastTypingSent.current = now;
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, []);

  // ── History ──────────────────────────────────────────────────────────
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  /** Fetches the messages before the oldest one shown (scrolling up). */
  const loadEarlier = useCallback(async () => {
    const page = qc.getQueryData<MessagesPage>(key);
    const oldest = page?.messages[0]?.id;
    if (!page?.hasMore || !oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const older = await unwrap(
        chat.messages.$get({ param: { id: roomId }, query: { before: oldest, limit: '50' } }),
      );
      update((p) => ({
        ...p,
        messages: merge(p.messages, older.messages),
        hasMore: older.hasMore,
      }));
    } catch {
      // Scrolling up again tries again.
    } finally {
      setLoadingEarlier(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, loadingEarlier, update]);

  /** Changes your message's text (for a few minutes after sending). */
  const edit = useCallback(
    async (messageId: string, body: string, mentions: string[]) => {
      const message = await unwrap(
        chat.messages[':messageId'].$patch({
          param: { id: roomId, messageId },
          json: { body, mentions },
        }),
      );
      update((p) => ({ ...p, messages: merge(p.messages, [message]) }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, update],
  );

  /** Deletes your message; it shows as deleted for everyone. */
  const remove = useCallback(
    async (messageId: string) => {
      const message = await unwrap(
        chat.messages[':messageId'].$delete({ param: { id: roomId, messageId } }),
      );
      update((p) => ({ ...p, messages: merge(p.messages, [message]) }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, update],
  );

  /** Reacts to a message (null takes it back); shows straight away. */
  const react = useCallback(
    async (messageId: string, emoji: Reaction | null) => {
      if (!myId) return;
      const setReactions = (fn: (r: ChatMessage['reactions']) => ChatMessage['reactions']) =>
        update((p) => ({
          ...p,
          messages: p.messages.map((m) =>
            m.id === messageId ? { ...m, reactions: fn(m.reactions) } : m,
          ),
        }));
      setReactions((list) => {
        const others = list
          .map((r) => ({ ...r, userIds: r.userIds.filter((u) => u !== myId) }))
          .filter((r) => r.userIds.length);
        if (!emoji) return others;
        const existing = others.find((r) => r.emoji === emoji);
        return existing
          ? others.map((r) => (r === existing ? { ...r, userIds: [...r.userIds, myId] } : r))
          : [...others, { emoji, userIds: [myId] }];
      });
      try {
        const res = await unwrap(
          chat.messages[':messageId'].react.$post({
            param: { id: roomId, messageId },
            json: { emoji },
          }),
        );
        setReactions(() => res.reactions);
      } catch (err) {
        void qc.invalidateQueries({ queryKey: key });
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, myId, update],
  );

  // ── View model ───────────────────────────────────────────────────────
  const items = useMemo<ChatItem[]>(() => {
    const readUpTo = history.data?.othersReadUpTo ?? null;
    const confirmed = (history.data?.messages ?? []).map((message) => {
      const mine = message.sender?.id === myId;
      const status: MessageStatus | null = mine
        ? readUpTo && message.createdAt <= readUpTo
          ? 'seen'
          : 'sent'
        : null;
      return { message, mine, status };
    });
    const confirmedIds = new Set(confirmed.map((c) => c.message.id));
    const waiting = [...pending.values()]
      .filter((p) => !confirmedIds.has(p.message.id))
      .map(({ message, failed }) => ({
        message,
        mine: true,
        status: (failed ? 'failed' : 'sending') as MessageStatus,
      }));
    return [...confirmed, ...waiting];
  }, [history.data, pending, myId]);

  return {
    items,
    hasMore: history.data?.hasMore ?? false,
    loadingEarlier,
    loadEarlier,
    /** How far you had read when the chat loaded, for the "new messages" line. */
    myReadUpTo: history.data?.myReadUpTo ?? null,
    edit,
    remove,
    isLoading: history.isLoading,
    /** Messages are here (a later refresh may still have failed: see `error`). */
    loaded: history.data !== undefined,
    error: history.error,
    refetch: history.refetch,
    typingName: typing?.name ?? null,
    send,
    retry,
    vote,
    react,
    notifyTyping,
  };
}
