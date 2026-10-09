import type {
  ActivityDetail,
  CommunitySummary,
  CreateActivityInput,
  UpdateActivityInput,
  CreateReportInput,
  DiscoverFilter,
  Me,
  UpdateMeInput,
} from '@buddy/shared';
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { authClient } from './auth-client';
import { useAccountStore } from '@/store/account';
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
  feed: (filter: DiscoverFilter) => ['activities', 'feed', filter] as const,
  fromCommunities: ['activities', 'from-communities'] as const,
  picks: ['activities', 'picks'] as const,
  mine: (role: 'joined' | 'hosting') => ['activities', 'mine', role] as const,
  history: ['activities', 'history'] as const,
  activity: (id: string) => ['activities', 'detail', id] as const,
  activities: ['activities'] as const,
  communities: ['communities'] as const,
  community: (id: string) => ['communities', id] as const,
  user: (id: string) => ['users', id] as const,
  messages: (activityId: string) => ['chat', activityId] as const,
  blocked: ['blocked'] as const,
};

// ── Reads ────────────────────────────────────────────────────────────────

export const useMe = (enabled = true) =>
  useQuery({ queryKey: keys.me, queryFn: () => unwrap(api.me.$get()), enabled });

export const useFeed = (filter: DiscoverFilter) =>
  useQuery({
    queryKey: keys.feed(filter),
    queryFn: async () => (await unwrap(api.activities.$get({ query: { filter } }))).activities,
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

export const useCommunities = () =>
  useQuery({
    queryKey: keys.communities,
    queryFn: async () => (await unwrap(api.communities.$get())).communities,
  });

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
    onSuccess: (detail) => refreshActivityLists(qc, detail),
  });
}

export function useLeaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.activities[':id'].membership.$delete({ param: { id } })),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
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
    onSuccess: (detail) => refreshActivityLists(qc, detail),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityInput) => unwrap(api.activities.$post({ json: input })),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
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
    mutationFn: (id: string) => unwrap(api.activities[':id'].cancel.$post({ param: { id } })),
    onSuccess: (detail) => refreshActivityLists(qc, detail),
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
    onSuccess: (me: Me) => {
      qc.setQueryData(keys.me, me);
      // Interests and area change rankings and distances.
      return qc.invalidateQueries({ queryKey: keys.activities });
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
