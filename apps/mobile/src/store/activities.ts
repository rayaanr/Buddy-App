import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SEED_ACTIVITIES } from '@/data/activities';
import { SEED_COMMUNITIES } from '@/data/communities';
import { ACTIVITY_TYPES, type CreateDay } from '@/data/constants';
import { firstName, newId, shortLocation } from '@/lib/activity';
import type {
  Account,
  Activity,
  ChatMessage,
  Community,
  DayLabel,
  MessageStatus,
} from '@/types/models';
import { persistStorage } from './storage';

export interface ActivityDraft {
  title: string;
  type: string;
  day: CreateDay;
  time: string;
  where: string;
  spots: number;
  notes: string;
}

interface ActivitiesState {
  activities: Activity[];
  communities: Community[];

  join: (id: string, yourName: string) => void;
  leave: (id: string, yourName: string) => void;
  publish: (draft: ActivityDraft, account: Account) => string;
  toggleCommunity: (id: string) => void;
  addMessage: (activityId: string, message: ChatMessage) => void;
  setMessageStatus: (activityId: string, messageId: string, status: MessageStatus) => void;
  markMineSeen: (activityId: string) => void;
}

const draftDay = (day: CreateDay, time: string): DayLabel => {
  if (day === 'Today') return parseInt(time, 10) >= 17 ? 'Tonight' : 'Today';
  return day === 'Tmrw' ? 'Tomorrow' : day;
};

export const useActivitiesStore = create<ActivitiesState>()(
  persist(
    (set) => {
      const update = (id: string, fn: (a: Activity) => Activity) =>
        set((s) => ({ activities: s.activities.map((a) => (a.id === id ? fn(a) : a)) }));

      const system = (text: string): ChatMessage => ({ id: newId('m'), kind: 'system', text });

      return {
        activities: SEED_ACTIVITIES,
        communities: SEED_COMMUNITIES,

        join: (id, yourName) =>
          update(id, (a) => ({
            ...a,
            joined: true,
            going: a.going + 1,
            messages: [...a.messages, system(`${firstName(yourName)} joined`)],
          })),

        leave: (id, yourName) =>
          update(id, (a) => ({
            ...a,
            joined: false,
            going: a.going - 1,
            messages: [...a.messages, system(`${firstName(yourName)} left`)],
          })),

        publish: (draft, account) => {
          const type = ACTIVITY_TYPES.find((t) => t.label === draft.type) ?? ACTIVITY_TYPES[0]!;
          const where = draft.where.trim();
          const activity: Activity = {
            id: newId('n'),
            title: draft.title.trim(),
            category: type.category,
            group: type.group,
            day: draftDay(draft.day, draft.time),
            time: draft.time,
            place: where,
            placeDetail: `${shortLocation(account.location)} · nearby`,
            distance: 'nearby',
            area: where,
            capacity: draft.spots,
            going: 1,
            hosting: true,
            host: `${firstName(account.name)} (you)`,
            hostColor: '#3a6b35',
            hostMeta: 'First time hosting',
            hue: type.hue,
            image: type.image,
            description: draft.notes.trim(),
            communityId: null,
            messages: [system('You created this activity')],
          };
          set((s) => ({ activities: [activity, ...s.activities] }));
          return activity.id;
        },

        toggleCommunity: (id) =>
          set((s) => ({
            communities: s.communities.map((c) => (c.id === id ? { ...c, joined: !c.joined } : c)),
          })),

        addMessage: (activityId, message) =>
          update(activityId, (a) => ({ ...a, messages: [...a.messages, message] })),

        setMessageStatus: (activityId, messageId, status) =>
          update(activityId, (a) => ({
            ...a,
            messages: a.messages.map((m) =>
              m.id === messageId && m.kind === 'me' ? { ...m, status } : m,
            ),
          })),

        markMineSeen: (activityId) =>
          update(activityId, (a) => ({
            ...a,
            messages: a.messages.map((m) => (m.kind === 'me' ? { ...m, status: 'seen' } : m)),
          })),
      };
    },
    {
      name: 'buddy-activities',
      version: 1,
      storage: persistStorage,
      partialize: ({ activities, communities }) => ({
        // A message still "sending" when the app closed can't stay stuck in that state.
        activities: activities.map((a) => ({
          ...a,
          messages: a.messages.map((m) =>
            m.kind === 'me' && m.status === 'sending' ? { ...m, status: 'sent' as const } : m,
          ),
        })),
        communities,
      }),
    },
  ),
);

export const useActivity = (id: string | undefined) =>
  useActivitiesStore((s) => s.activities.find((a) => a.id === id));

export const useCommunity = (id: string | null | undefined) =>
  useActivitiesStore((s) => (id ? s.communities.find((c) => c.id === id) : undefined));
