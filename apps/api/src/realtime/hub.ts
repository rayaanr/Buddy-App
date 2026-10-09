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
export class ChatHub {
  private rooms = new Map<string, Set<Peer>>();

  /** Registers a connection; returns a function that unregisters it. */
  join(activityId: string, peer: Peer) {
    let room = this.rooms.get(activityId);
    if (!room) this.rooms.set(activityId, (room = new Set()));
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
