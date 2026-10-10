import { serverEvent, type ChatMessage, type MessagesPage } from '@buddy/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { API_URL } from '@/config';
import { sessionCookie } from './auth-client';
import { api, unwrap } from './client';
import { askForPush } from './push';
import { keys } from './queries';

export type MessageStatus = 'sending' | 'failed' | 'sent' | 'seen';

/** A message as the chat screen shows it: confirmed or still on its way. */
export interface ChatItem {
  message: ChatMessage;
  mine: boolean;
  status: MessageStatus | null;
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

const wsUrl = (activityId: string) =>
  `${API_URL.replace(/^http/, 'ws')}/v1/activities/${activityId}/chat/ws`;

/** Inserts or replaces messages by id, keeping oldest-first order. */
function merge(list: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Live group chat for one activity: history over HTTP, live events over a
 * WebSocket (with reconnect and catch-up), optimistic sends with retry,
 * typing indicators and read receipts.
 */
export function useChat(activityId: string, myId: string | undefined) {
  const qc = useQueryClient();
  const key = keys.messages(activityId);
  const history = useQuery({
    queryKey: key,
    queryFn: () =>
      unwrap(api.activities[':id'].chat.messages.$get({ param: { id: activityId }, query: {} })),
  });

  const [pending, setPending] = useState<Map<string, { message: ChatMessage; failed: boolean }>>(
    new Map(),
  );
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
    [qc, activityId],
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
        api.activities[':id'].chat.messages.$get({ param: { id: activityId }, query: { after } }),
      ).catch(() => null);
      if (missed) {
        update((p) => ({
          messages: merge(p.messages, missed.messages),
          othersReadUpTo: missed.othersReadUpTo ?? p.othersReadUpTo,
        }));
      }
    };

    const connect = async () => {
      const cookie = await sessionCookie();
      if (closedByUs) return;
      const ws = new NativeWebSocket(wsUrl(activityId), undefined, {
        headers: cookie ? { cookie } : {},
      });
      socket.current = ws;

      ws.onopen = () => {
        attempt = 0;
        void catchUp();
      };
      ws.onmessage = (e) => {
        const parsed = serverEvent.safeParse(JSON.parse(String(e.data)));
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
        const delay = Math.min(RECONNECT_MAX_MS, 1000 * 2 ** attempt++);
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
  }, [activityId]);

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
    void unwrap(
      api.activities[':id'].chat.read.$post({ param: { id: activityId }, json: { messageId: id } }),
    ).catch(() => {
      lastMarked.current = null;
    });
  }, [activityId, latestFromOthers?.id]);

  // ── Sending ──────────────────────────────────────────────────────────
  const post = useCallback(
    async (id: string, body: string) => {
      try {
        const message = await unwrap(
          api.activities[':id'].chat.messages.$post({
            param: { id: activityId },
            json: { id, body },
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
          const item = prev.get(id);
          if (!item) return prev;
          return new Map(prev).set(id, { ...item, failed: true });
        });
      }
    },
    [activityId, update],
  );

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body || !myId) return;
      const id = randomUUID();
      const message: ChatMessage = {
        id,
        activityId,
        kind: 'user',
        sender: { id: myId, name: '', avatarUrl: null },
        body,
        createdAt: new Date().toISOString(),
      };
      setPending((prev) => new Map(prev).set(id, { message, failed: false }));
      void post(id, body);
    },
    [activityId, myId, post],
  );

  /** Same id as the first attempt, so the server never stores it twice. */
  const retry = useCallback(
    (id: string) => {
      const item = pending.get(id);
      if (!item) return;
      setPending((prev) => new Map(prev).set(id, { ...item, failed: false }));
      void post(id, item.message.body);
    },
    [pending, post],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_SEND_EVERY_MS) return;
    lastTypingSent.current = now;
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, []);

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
    isLoading: history.isLoading,
    error: history.error,
    refetch: history.refetch,
    typingName: typing?.name ?? null,
    send,
    retry,
    notifyTyping,
  };
}
