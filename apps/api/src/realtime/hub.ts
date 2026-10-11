import type { ServerEvent } from '@buddy/shared';

export interface Peer {
  userId: string;
  send(event: ServerEvent): void;
  close(): void;
}

/**
 * Which phones are connected to which chat, in this process's memory.
 * One API process holds every connection; running more than one would need
 * a shared channel (e.g. Redis pub/sub) to relay events between them.
 */
/**
 * Largest message a phone may send over a chat socket. The only one is
 * {"type":"typing"}; without this, ws accepts up to 100 MB.
 */
export const WS_MAX_BYTES = 1024;

/** Open connections one person may keep to one chat, and to all chats. */
const PER_ROOM = 3;
const PER_USER = 12;

export class ChatHub {
  private rooms = new Map<string, Set<Peer>>();
  private typedAt = new Map<string, number>();

  /**
   * Registers a connection; returns a function that unregisters it. Past
   * the per-person limits the oldest connection is closed: usually one the
   * phone lost without saying so.
   */
  join(activityId: string, peer: Peer) {
    let room = this.rooms.get(activityId);
    if (!room) this.rooms.set(activityId, (room = new Set()));
    const mine = (peers: Iterable<Peer>) => [...peers].filter((p) => p.userId === peer.userId);
    const inRoom = mine(room);
    if (inRoom.length >= PER_ROOM) inRoom[0]!.close();
    const everywhere = [...this.rooms.values()].flatMap((r) => mine(r));
    if (everywhere.length >= PER_USER) everywhere[0]!.close();
    room.add(peer);
    return () => {
      room.delete(peer);
      if (room.size === 0) this.rooms.delete(activityId);
    };
  }

  /** Sends an event to everyone connected to a chat, except the listed users. */
  publish(activityId: string, event: ServerEvent, options: { except?: Iterable<string> } = {}) {
    const except = new Set(options.except);
    for (const peer of this.rooms.get(activityId) ?? []) {
      if (except.has(peer.userId)) continue;
      try {
        peer.send(event);
      } catch {
        // A dead socket is cleaned up by its close handler; keep delivering to others.
      }
    }
  }

  /**
   * Whether to pass on someone's "typing" now: at most once per `everyMs`
   * per person and chat, however many connections they have open.
   */
  mayType(activityId: string, userId: string, everyMs: number) {
    const key = `${activityId}:${userId}`;
    const now = Date.now();
    if (now - (this.typedAt.get(key) ?? 0) < everyMs) return false;
    // Old entries are useless after a few seconds; don't let the map grow.
    if (this.typedAt.size > 10_000) this.typedAt.clear();
    this.typedAt.set(key, now);
    return true;
  }

  /** Users with at least one open connection to this chat. */
  connectedUsers(activityId: string) {
    return new Set([...(this.rooms.get(activityId) ?? [])].map((p) => p.userId));
  }

  /** Closes a user's connections to one chat, e.g. after they leave the activity. */
  disconnect(activityId: string, userId: string) {
    for (const peer of [...(this.rooms.get(activityId) ?? [])]) {
      if (peer.userId === userId) peer.close();
    }
  }

  /** Closes all of a user's connections, e.g. after account deletion. */
  disconnectEverywhere(userId: string) {
    for (const activityId of [...this.rooms.keys()]) this.disconnect(activityId, userId);
  }

  get size() {
    let n = 0;
    for (const room of this.rooms.values()) n += room.size;
    return n;
  }
}
