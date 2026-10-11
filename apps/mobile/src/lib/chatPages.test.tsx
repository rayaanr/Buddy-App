import type { ChatMessage, MessagesPage } from '@buddy/shared';
import { describe, expect, it } from '@jest/globals';

import { refreshed } from './chatPages';

const msg = (id: string, minute: number, body = id) =>
  ({
    id,
    body,
    createdAt: `2026-10-11T10:${String(minute).padStart(2, '0')}:00.000Z`,
  }) as ChatMessage;
const page = (messages: ChatMessage[], extra: Partial<MessagesPage> = {}) =>
  ({ messages, hasMore: false, myReadUpTo: null, othersReadUpTo: null, ...extra }) as MessagesPage;
const ids = (p: MessagesPage) => p.messages.map((m) => m.id);

describe('refreshing a chat', () => {
  it('keeps older pages loaded by scrolling up', () => {
    const cached = page([msg('a', 1), msg('b', 2), msg('c', 3), msg('d', 4)], { hasMore: true });
    const latest = page([msg('c', 3), msg('d', 4)], { hasMore: true });
    const next = refreshed(cached, latest);
    expect(ids(next)).toEqual(['a', 'b', 'c', 'd']);
    // More before "a" still to load.
    expect(next.hasMore).toBe(true);
  });

  it('takes edits and removals from the refreshed stretch', () => {
    const cached = page([msg('a', 1), msg('b', 2), msg('c', 3), msg('d', 4)]);
    const latest = page([msg('b', 2), msg('d', 4, 'edited')]);
    const next = refreshed(cached, latest);
    expect(ids(next)).toEqual(['a', 'b', 'd']);
    expect(next.messages.at(-1)!.body).toBe('edited');
  });

  it('keeps messages that arrived live during the request', () => {
    const cached = page([msg('a', 1), msg('b', 2), msg('live', 5)]);
    const next = refreshed(cached, page([msg('a', 1), msg('b', 2)]));
    expect(ids(next)).toEqual(['a', 'b', 'live']);
  });

  it('leaves the new-messages line where it was on opening', () => {
    const cached = page([msg('a', 1)], { myReadUpTo: '2026-10-11T10:00:00.000Z' });
    const latest = page([msg('a', 1)], { myReadUpTo: '2026-10-11T10:01:00.000Z' });
    expect(refreshed(cached, latest).myReadUpTo).toBe('2026-10-11T10:00:00.000Z');
  });

  it('uses the page as it is the first time', () => {
    const latest = page([msg('a', 1)], { hasMore: true });
    expect(refreshed(undefined, latest)).toBe(latest);
  });
});
