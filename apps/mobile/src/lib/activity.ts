import type { DiscoverFilter } from '@/data/constants';
import { colors } from '@/theme';
import type { Activity, Community } from '@/types/models';

export const spotsLeft = (a: Activity) => a.capacity - a.going;

export const isParticipating = (a: Activity) => !!(a.joined || a.hosting);

export const whenLabel = (a: Activity) => `${a.day} · ${a.time}`;

export const whenLong = (a: Activity) => `${a.day}, ${a.time}`;

/** Short status shown on list rows: "Going", "Hosting", "Full" or "3 left". */
export function leftLabel(a: Activity) {
  if (a.hosting) return 'Hosting';
  if (a.joined) return 'Going';
  const left = spotsLeft(a);
  return left <= 0 ? 'Full' : `${left} left`;
}

export function spotsLabel(a: Activity) {
  const left = spotsLeft(a);
  if (left <= 0) return 'Full';
  return `${left} spot${left === 1 ? '' : 's'} left`;
}

/** Lime when you're in, muted when full, orange when 3 or fewer spots remain. */
export function availabilityColor(a: Activity) {
  const left = spotsLeft(a);
  if (isParticipating(a)) return colors.lime;
  if (left <= 0) return colors.muted;
  if (left <= 3) return colors.warning;
  return colors.ink;
}

export function lastMessagePreview(a: Activity) {
  const last = [...a.messages].reverse().find((m) => m.kind !== 'system');
  if (!last) return 'No messages yet. Say hi.';
  return `${last.kind === 'me' ? 'You' : last.from}: ${last.text}`;
}

export function matchesFilter(a: Activity, filter: DiscoverFilter) {
  switch (filter) {
    case 'All':
      return true;
    case 'Tonight':
      return a.day === 'Tonight' || a.day === 'Today';
    case 'Weekend':
      return a.day === 'Sat' || a.day === 'Sun';
    case 'Sports':
      return a.group === 'Sports' || a.group === 'Running';
    default:
      return a.group === filter;
  }
}

const DECK_SIZE = 5;

/**
 * Builds the "Picked for you" deck: open activities you're not already in,
 * ranked by joined-community first, then matching interest, then feed order.
 */
export function buildDeck(activities: Activity[], interests: string[], communities: Community[]) {
  const joinedComms = new Set(communities.filter((c) => c.joined).map((c) => c.id));
  const score = (a: Activity) =>
    (a.communityId && joinedComms.has(a.communityId) ? 2 : 0) +
    (a.interest && interests.includes(a.interest) ? 1 : 0);

  return activities
    .filter((a) => !isParticipating(a) && spotsLeft(a) > 0)
    .map((a, index) => ({ a, index, s: score(a) }))
    .sort((x, y) => y.s - x.s || x.index - y.index)
    .slice(0, DECK_SIZE)
    .map((x) => x.a.id);
}

/** Why a card is in the deck, e.g. "From Colombo Runners". */
export function deckReason(a: Activity, interests: string[], communities: Community[]) {
  const community = communities.find((c) => c.id === a.communityId);
  if (community?.joined) return `From ${community.name}`;
  if (a.interest && interests.includes(a.interest)) return `Because you’re into ${a.interest}`;
  return 'Popular nearby';
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const shortLocation = (location: string) => location.split(',')[0] ?? location;

export const clockTime = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
