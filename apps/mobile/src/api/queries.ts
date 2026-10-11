import type {
  ActivityDetail,
  CommunitySummary,
  CreateCommunityInput,
  UpdateCommunityInput,
  CreateActivityInput,
  UpdateActivityInput,
  CreateReportInput,
  DiscoverFilter,
  RemovalReason,
  Me,
  ResolveReportInput,
  UpdateMeInput,
} from '@buddy/shared';
import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { authClient } from './auth-client';
import { askForPush } from './push';
import { useAccountStore } from '@/store/account';
import { useDiscoverStore } from '@/store/discover';
import { ApiRequestError, api, unwrap } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't hammer the API on auth or validation errors; do retry flaky networks.
      retry: (count, err) =>
        count < 2 && !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500),
    },
  },
});

/** Query keys in one place, so mutations invalidate exactly what they affect. */
export const keys = {
  me: ['me'] as const,
  feed: (filter: DiscoverFilter, where: Record<string, string>) =>
    ['activities', 'feed', filter, where] as const,
  fromCommunities: ['activities', 'from-communities'] as const,
  picks: ['activities', 'picks'] as const,
  mine: (role: 'joined' | 'hosting') => ['activities', 'mine', role] as const,
  history: ['activities', 'history'] as const,
  activity: (id: string) => ['activities', 'detail', id] as const,
  activities: ['activities'] as const,
  communities: ['communities'] as const,
  community: (id: string) => ['communities', id] as const,
  communityMembers: (id: string) => ['communities', id, 'members'] as const,
  reports: (status: 'open' | 'resolved') => ['admin', 'reports', status] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  user: (id: string) => ['users', id] as const,
  messages: (activityId: string) => ['chat', activityId] as const,
  chats: ['chats'] as const,
  invitees: (activityId: string) => ['activities', 'invitees', activityId] as const,
  blocked: ['blocked'] as const,
};

// ── Reads ────────────────────────────────────────────────────────────────

export const useMe = (enabled = true) =>
  useQuery({ queryKey: keys.me, queryFn: () => unwrap(api.me.$get()), enabled });

/** Discover, measured from where the Discover store says (home, near me, or a town). */
/** Discover's list; `search` (2+ letters) looks island-wide instead. */
export function useFeed(filter: DiscoverFilter, search = '') {
  const origin = useDiscoverStore((s) => s.origin);
  const radiusKm = useDiscoverStore((s) => s.radiusKm);
  const here = useDiscoverStore((s) => s.here);
  const where: Record<string, string> = { radiusKm: String(radiusKm) };
  if (origin.kind === 'here' && here) {
    // ~100 m is plenty, and keeps small movements from refetching.
    where.lat = here.lat.toFixed(3);
    where.lng = here.lng.toFixed(3);
  }
  if (origin.kind === 'town') where.placeId = String(origin.id);
  const q = search.trim();
  if (q.length >= 2) where.q = q;
  return useQuery({
    queryKey: keys.feed(filter, where),
    queryFn: () => unwrap(api.activities.$get({ query: { filter, ...where } })),
    // While typing, keep the last results up rather than flashing a skeleton.
    placeholderData: where.q ? keepPreviousData : undefined,
    // Near me, before the phone has said where it is: wait rather than show home.
    enabled: origin.kind !== 'here' || !!here,
  });
}

/** Towns matching what's typed (public: also used on Sign up). */
export const usePlaceSearch = (q: string) =>
  useQuery({
    queryKey: ['places', q.trim().toLowerCase()],
    queryFn: async () => (await unwrap(api.places.search.$get({ query: { q: q.trim() } }))).places,
    enabled: q.trim().length >= 1,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  });

/** The town nearest a point ("Use my current location"). */
export const nearestPlace = (point: { lat: number; lng: number }) =>
  unwrap(api.places.nearest.$get({ query: { lat: String(point.lat), lng: String(point.lng) } }));

/** Meeting points matching what's typed, near `near` (or your home town). */
export const useVenueSearch = (q: string, near: { lat: number; lng: number } | null) =>
  useQuery({
    queryKey: ['venues', q.trim().toLowerCase(), near?.lat.toFixed(2), near?.lng.toFixed(2)],
    queryFn: () =>
      unwrap(
        api.venues.search.$get({
          query: {
            q: q.trim(),
            ...(near && { lat: String(near.lat), lng: String(near.lng) }),
          },
        }),
      ),
    enabled: q.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

export const useFromCommunities = () =>
  useQuery({
    queryKey: keys.fromCommunities,
    queryFn: async () => (await unwrap(api.activities['from-communities'].$get())).activities,
  });

export const usePicks = (enabled = true) =>
  useQuery({
    queryKey: keys.picks,
    queryFn: async () => (await unwrap(api.activities.picks.$get())).picks,
    enabled,
  });

export const useMyActivities = (role: 'joined' | 'hosting') =>
  useQuery({
    queryKey: keys.mine(role),
    queryFn: async () => (await unwrap(api.activities.mine.$get({ query: { role } }))).activities,
  });

export const useHistory = () =>
  useQuery({
    queryKey: keys.history,
    queryFn: async () => (await unwrap(api.activities.history.$get())).activities,
  });

export const useActivity = (id: string) =>
  useQuery({
    queryKey: keys.activity(id),
    queryFn: () => unwrap(api.activities[':id'].$get({ param: { id } })),
    enabled: !!id,
  });

/** Everyone going; fetched when the members drawer opens. */
export const useActivityMembers = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: [...keys.activity(id), 'members'],
    queryFn: () => unwrap(api.activities[':id'].members.$get({ param: { id } })),
    enabled,
  });

/** Nearest first; `search` (2+ letters) matches names, descriptions and towns. */
export function useCommunities(search = '') {
  const q = search.trim();
  return useQuery({
    queryKey: q.length >= 2 ? [...keys.communities, 'search', q] : keys.communities,
    queryFn: async () =>
      (await unwrap(api.communities.$get({ query: q.length >= 2 ? { q } : {} }))).communities,
    placeholderData: q.length >= 2 ? keepPreviousData : undefined,
  });
}

export const useCommunity = (id: string) =>
  useQuery({
    queryKey: keys.community(id),
    queryFn: () => unwrap(api.communities[':id'].$get({ param: { id } })),
    enabled: !!id,
  });

export const useUser = (id: string) =>
  useQuery({
    queryKey: keys.user(id),
    queryFn: () => unwrap(api.users[':id'].$get({ param: { id } })),
    enabled: !!id,
  });

export const useBlocked = () =>
  useQuery({
    queryKey: keys.blocked,
    queryFn: async () => (await unwrap(api.me.blocks.$get())).people,
  });

// ── Writes ───────────────────────────────────────────────────────────────

/** After a membership change, lists showing counts or "Going" need refreshing. */
function refreshActivityLists(qc: QueryClient, detail?: ActivityDetail) {
  if (detail) qc.setQueryData(keys.activity(detail.id), detail);
  const except: QueryKey = detail ? keys.activity(detail.id) : [];
  return qc.invalidateQueries({
    predicate: (q) =>
      ['activities', 'communities', 'users', 'me'].includes(String(q.queryKey[0])) &&
      JSON.stringify(q.queryKey) !== JSON.stringify(except),
  });
}

export function useJoinActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.activities[':id'].membership.$post({ param: { id } })),
    onSuccess: (detail) => {
      void askForPush();
      return refreshActivityLists(qc, detail);
    },
  });
}

export function useLeaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.activities[':id'].membership.$delete({ param: { id } })),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
  });
}

export function useRemoveGuest(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: RemovalReason }) =>
      unwrap(
        api.activities[':id'].members[':userId'].remove.$post({
          param: { id: activityId, userId },
          json: { reason },
        }),
      ),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
  });
}

/** People you could invite to an activity (you've been at one together). */
export const useInvitees = (activityId: string) =>
  useQuery({
    queryKey: keys.invitees(activityId),
    queryFn: async () =>
      (await unwrap(api.activities[':id'].invitees.$get({ param: { id: activityId } }))).people,
  });

export function useInvite(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: { userIds: string[]; note?: string }) =>
      unwrap(api.activities[':id'].invites.$post({ param: { id: activityId }, json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invitees(activityId) }),
  });
}

export function useMuteCommunityChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      unwrap(api.communities[':id'].mute.$post({ param: { id }, json: { muted } })),
    onSuccess: (detail) => qc.setQueryData(keys.community(detail.id), detail),
  });
}

export function useMuteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      unwrap(api.activities[':id'].mute.$post({ param: { id }, json: { muted } })),
    onSuccess: (detail) => qc.setQueryData(keys.activity(detail.id), detail),
  });
}

export function useWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, waiting }: { id: string; waiting: boolean }) =>
      unwrap(
        waiting
          ? api.activities[':id'].waitlist.$delete({ param: { id } })
          : api.activities[':id'].waitlist.$post({ param: { id } }),
      ),
    onSuccess: (detail) => {
      void askForPush();
      return refreshActivityLists(qc, detail);
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityInput) => unwrap(api.activities.$post({ json: input })),
    onSuccess: (detail) => {
      void askForPush();
      return refreshActivityLists(qc, detail);
    },
  });
}

export function useUpdateActivity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateActivityInput) =>
      unwrap(api.activities[':id'].$patch({ param: { id }, json: input })),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
  });
}

export function useCancelActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stopRepeating = false }: { id: string; stopRepeating?: boolean }) =>
      unwrap(api.activities[':id'].cancel.$post({ param: { id }, json: { stopRepeating } })),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommunityInput) => unwrap(api.communities.$post({ json: input })),
    onSuccess: (detail) => {
      qc.setQueryData(keys.community(detail.id), detail);
      return qc.invalidateQueries({ queryKey: keys.communities });
    },
  });
}

export function useUpdateCommunity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCommunityInput) =>
      unwrap(api.communities[':id'].$patch({ param: { id }, json: input })),
    onSuccess: (detail) => {
      qc.setQueryData(keys.community(id), detail);
      // The name shows on activity cards too.
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.communities, exact: true }),
        qc.invalidateQueries({ queryKey: keys.activities }),
      ]);
    },
  });
}

export function useToggleCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Pick<CommunitySummary, 'id' | 'joined'>) =>
      unwrap(
        c.joined
          ? api.communities[':id'].membership.$delete({ param: { id: c.id } })
          : api.communities[':id'].membership.$post({ param: { id: c.id } }),
      ),
    onSuccess: () => refreshActivityLists(qc),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateMeInput) => unwrap(api.me.$patch({ json: patch })),
    onSuccess: (me: Me, patch) => {
      qc.setQueryData(keys.me, me);
      // Interests and home town change rankings and distances; a name, bio or
      // notification switch doesn't touch any activity list.
      if (patch.interests || patch.placeId !== undefined) {
        return qc.invalidateQueries({ queryKey: keys.activities });
      }
    },
  });
}

/** Blocks or unblocks someone. Blocking hides content everywhere, so everything refetches. */
export function useSetBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      blocked
        ? unwrap(api.users[':id'].block.$post({ param: { id: userId } }))
        : unwrap(api.users[':id'].block.$delete({ param: { id: userId } })),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => unwrap(api.reports.$post({ json: input })),
  });
}

/** Signs out on the server, then forgets every cached response. */
export async function signOut() {
  await authClient.signOut().catch(() => {});
  queryClient.clear();
}

/**
 * Permanently deletes the account on the server (sessions and push tokens go
 * with it), then clears everything this device remembers about it.
 */
export async function deleteAccount() {
  await unwrap(api.me.$delete());
  useAccountStore.getState().forget();
  await signOut();
}

// ── Community creator tools ──────────────────────────────────────────────

export const useCommunityMembers = (id: string) =>
  useQuery({
    queryKey: keys.communityMembers(id),
    queryFn: async () =>
      (await unwrap(api.communities[':id'].members.$get({ param: { id } }))).members,
  });

export function useRemoveCommunityMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.communities[':id'].members[':userId'].$delete({ param: { id, userId } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.community(id) }),
  });
}

export function useDeleteCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.communities[':id'].$delete({ param: { id } })),
    onSuccess: (_, id) => {
      // Gone: drop it (and its members) rather than refetch a 404.
      qc.removeQueries({ queryKey: keys.community(id) });
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.communities, exact: true }),
        qc.invalidateQueries({ queryKey: keys.activities }),
      ]);
    },
  });
}

// ── Moderation (admins only) ─────────────────────────────────────────────

export const useAdminReports = (status: 'open' | 'resolved') =>
  useQuery({
    queryKey: keys.reports(status),
    queryFn: async () => (await unwrap(api.admin.reports.$get({ query: { status } }))).reports,
  });

/** Everything a decision can change: reports, and what people see. */
const refreshAfterModeration = (qc: QueryClient) =>
  qc.invalidateQueries({
    predicate: (q) =>
      ['admin', 'activities', 'communities', 'users'].includes(String(q.queryKey[0])),
  });

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...json }: { id: string } & ResolveReportInput) =>
      unwrap(api.admin.reports[':id'].resolve.$post({ param: { id }, json })),
    onSuccess: () => refreshAfterModeration(qc),
  });
}

export function useLiftSuspension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.admin.suspensions[':id'].$delete({ param: { id: userId } })),
    onSuccess: () => refreshAfterModeration(qc),
  });
}

// ── Chats ────────────────────────────────────────────────────────────────

/** Every group chat you're in, newest first; checked every half minute. */
export const useChats = () =>
  useQuery({
    queryKey: keys.chats,
    queryFn: async () => (await unwrap(api.chats.$get())).chats,
    refetchInterval: 30_000,
  });

/** Unread messages: in one chat (by activity or community id), or in all of them. */
export function useUnreadMessages(id?: string) {
  const chats = useChats().data ?? [];
  return id
    ? (chats.find((c) => c.id === id)?.unread ?? 0)
    : chats.reduce((sum, c) => sum + (c.muted ? 0 : c.unread), 0);
}

// ── Notifications (the bell on Discover) ─────────────────────────────────

/** How many are unread; checked every minute and whenever the app comes back. */
export const useUnreadNotifications = () =>
  useQuery({
    queryKey: keys.unread,
    queryFn: async () => (await unwrap(api.notifications.unread.$get())).unread,
    refetchInterval: 60_000,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => unwrap(api.notifications.$get({ query: { limit: '50' } })),
  });

/** Opening the list marks everything read (the list keeps showing what was new). */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.notifications.read.$post()),
    onSuccess: () => qc.setQueryData(keys.unread, 0),
  });
}
