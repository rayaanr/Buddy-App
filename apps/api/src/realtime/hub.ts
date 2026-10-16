import type { ServerEvent } from '@buddy/shared';

import { type Cluster, PRESENCE_EVERY_MS } from '../lib/cluster';

export interface Peer {
  userId: string;
  send(event: ServerEvent): void;
  close(): void;
}

/**
 * Largest message a phone may send over a chat socket. The only one is
 * {"type":"typing"}; without this, ws accepts up to 100 MB.
 */
export const WS_MAX_BYTES = 1024;

/** Open connections one person may keep to one chat, and to all chats. */
const PER_ROOM = 3;
const PER_USER = 12;

/** What goes between instances on the "chat" channel. */
type HubMessage =
  | { kind: 'event'; room: string; event: ServerEvent; except: string[] }
  | { kind: 'disconnect'; room: string; userId: string }
  | { kind: 'disconnect-all'; userId: string };

/**
 * Which phones are connected to which chat. Each API instance holds its own
 * connections; events and disconnects go through the cluster (lib/cluster.ts)
 * so every instance delivers them to the phones it holds.
 */
export class ChatHub {
  private rooms = new Map<string, Set<Peer>>();
  private typedAt = new Map<string, number>();
  private reporter: ReturnType<typeof setInterval>;

  constructor(private cluster: Cluster) {
    cluster.on('chat', (m) => this.receive(m as HubMessage));
    // Tell the other instances who has chats open here (see connectedUsers).
    this.reporter = setInterval(() => void this.report(), PRESENCE_EVERY_MS);
    this.reporter.unref();
  }

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
    void this.cluster.presence.report([{ room: activityId, userId: peer.userId }]);
    return () => {
      room.delete(peer);
      if (room.size === 0) this.rooms.delete(activityId);
      if (![...room].some((p) => p.userId === peer.userId)) {
        void this.cluster.presence.left(activityId, peer.userId);
      }
    };
  }

  /** Sends an event to everyone connected to a chat, except the listed users. */
  publish(activityId: string, event: ServerEvent, options: { except?: Iterable<string> } = {}) {
    this.cluster.broadcast('chat', {
      kind: 'event',
      room: activityId,
      event,
      except: [...(options.except ?? [])],
    } satisfies HubMessage);
  }

  /**
   * Whether to pass on someone's "typing" now: at most once per `everyMs`
   * per person and chat, however many connections they have open (on this
   * instance; a phone stays on one).
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

  /** Users with at least one open connection to this chat, on any instance. */
  async connectedUsers(activityId: string) {
    const here = [...(this.rooms.get(activityId) ?? [])].map((p) => p.userId);
    return new Set([...here, ...(await this.cluster.presence.list(activityId))]);
  }

  /** Closes a user's connections to one chat, e.g. after they leave the activity. */
  disconnect(activityId: string, userId: string) {
    this.cluster.broadcast('chat', {
      kind: 'disconnect',
      room: activityId,
      userId,
    } satisfies HubMessage);
  }

  /** Closes all of a user's connections, e.g. after account deletion. */
  disconnectEverywhere(userId: string) {
    this.cluster.broadcast('chat', { kind: 'disconnect-all', userId } satisfies HubMessage);
  }

  /** Connections held by this instance. */
  get size() {
    let n = 0;
    for (const room of this.rooms.values()) n += room.size;
    return n;
  }

  stop() {
    clearInterval(this.reporter);
  }

  private receive(m: HubMessage) {
    switch (m.kind) {
      case 'event': {
        const except = new Set(m.except);
        for (const peer of this.rooms.get(m.room) ?? []) {
          if (except.has(peer.userId)) continue;
          try {
            peer.send(m.event);
          } catch {
            // A dead socket is cleaned up by its close handler; keep delivering to others.
          }
        }
        return;
      }
      case 'disconnect':
        for (const peer of [...(this.rooms.get(m.room) ?? [])]) {
          if (peer.userId === m.userId) peer.close();
        }
        return;
      case 'disconnect-all':
        for (const room of [...this.rooms.values()]) {
          for (const peer of [...room]) if (peer.userId === m.userId) peer.close();
        }
    }
  }

  private async report() {
    const pairs = [...this.rooms].flatMap(([room, peers]) =>
      [...new Set([...peers].map((p) => p.userId))].map((userId) => ({ room, userId })),
    );
    await this.cluster.presence.report(pairs).catch(() => {});
  }
}
