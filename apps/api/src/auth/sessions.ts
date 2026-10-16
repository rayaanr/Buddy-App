import type { SessionUser } from '../http/context';
import type { Cluster } from '../lib/cluster';

/** How long a checked session is trusted before asking the database again. */
const TTL_MS = 30_000;
const MAX_ENTRIES = 20_000;

/** The session cookie, with or without the __Secure- prefix Better Auth adds over HTTPS. */
const COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/;

type Forget = { token: string } | { userId: string };

/**
 * Remembers recently checked sessions for a few seconds, so a busy phone
 * doesn't cost two database queries per request just to say who it is.
 * Anything that ends or changes a session (sign-out, suspension, account
 * deletion, a new name) forgets it on every instance at once.
 */
export class SessionCache {
  private entries = new Map<string, { user: SessionUser; until: number }>();

  constructor(private cluster: Cluster) {
    cluster.on('sessions', (m) => this.drop(m as Forget));
  }

  /** The session token a request carries (signed, as sent), if any. */
  tokenOf(headers: Headers) {
    const match = COOKIE.exec(headers.get('cookie') ?? '');
    return match?.[1] ?? null;
  }

  get(token: string) {
    const entry = this.entries.get(token);
    if (!entry) return undefined;
    if (entry.until <= Date.now()) {
      this.entries.delete(token);
      return undefined;
    }
    return entry.user;
  }

  /** Remembers a session the database just confirmed, until it or TTL_MS ends. */
  set(token: string, user: SessionUser, expiresAt: Date) {
    if (this.entries.size >= MAX_ENTRIES) this.sweep();
    this.entries.set(token, { user, until: Math.min(Date.now() + TTL_MS, expiresAt.getTime()) });
  }

  forgetToken(token: string) {
    this.cluster.broadcast('sessions', { token } satisfies Forget);
  }

  /** All of someone's sessions, e.g. after they're suspended or change their name. */
  forgetUser(userId: string) {
    this.cluster.broadcast('sessions', { userId } satisfies Forget);
  }

  clear() {
    this.entries.clear();
  }

  private drop(m: Forget) {
    if ('token' in m) {
      this.entries.delete(m.token);
      return;
    }
    for (const [token, entry] of this.entries) {
      if (entry.user.id === m.userId) this.entries.delete(token);
    }
  }

  private sweep() {
    const now = Date.now();
    for (const [token, entry] of this.entries) if (entry.until <= now) this.entries.delete(token);
    // Still full: drop the oldest (Maps keep insertion order).
    for (const token of this.entries.keys()) {
      if (this.entries.size < MAX_ENTRIES) break;
      this.entries.delete(token);
    }
  }
}
