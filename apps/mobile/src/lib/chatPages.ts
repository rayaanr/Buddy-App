import type { ChatMessage, MessagesPage } from '@buddy/shared';

const order = (a: ChatMessage, b: ChatMessage) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function merge(list: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(order);
}

/**
 * A refreshed latest page, fitted into what's already here: it replaces the
 * same stretch of the chat (picking up edits, reactions and removals), while
 * older pages loaded by scrolling up, and messages that arrived live during
 * the request, stay. The "new messages" line stays where it was on opening.
 */
export function refreshed(cached: MessagesPage | undefined, latest: MessagesPage): MessagesPage {
  if (!cached) return latest;
  const first = latest.messages[0];
  const last = latest.messages.at(-1);
  if (!first || !last) return { ...latest, myReadUpTo: cached.myReadUpTo };
  const before = cached.messages.filter((m) => order(m, first) < 0);
  const after = cached.messages.filter((m) => order(m, last) > 0);
  return {
    ...latest,
    messages: [...before, ...latest.messages, ...after],
    hasMore: before.length ? cached.hasMore : latest.hasMore,
    myReadUpTo: cached.myReadUpTo,
  };
}
