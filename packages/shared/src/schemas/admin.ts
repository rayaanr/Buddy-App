import { z } from 'zod';

const count = z.number().int();

/** Admin → Dashboard: how Buddy is doing, in a few numbers. */
export const adminStats = z.object({
  people: z.object({
    total: count,
    /** Signed up in the last 7 / 30 days. */
    new7: count,
    new30: count,
    /** Used the app in the last 7 days (their session was refreshed). */
    active7: count,
    /** Finished first-run setup. */
    onboarded: count,
  }),
  activities: z.object({
    /** Coming up, not cancelled. */
    upcoming: count,
    /** Posted in the last 7 / 30 days. */
    created7: count,
    created30: count,
    /** Took place in the last 30 days (started, not cancelled). */
    happened30: count,
    /** Of those: how many people went on average (host included), and how many filled up. */
    avgGoing30: z.number(),
    filled30: count,
    /** Called off in the last 30 days. */
    cancelled30: count,
  }),
  /** Hosts' roll calls in the last 30 days: guests marked, and how many came. */
  showUp: z.object({ marked: count, came: count }),
  communities: z.object({ total: count, new30: count }),
  messages7: count,
  openReports: count,
  /** The last 14 days, oldest first ("YYYY-MM-DD", Sri Lanka time). */
  daily: z.array(z.object({ day: z.string(), signups: count, activities: count })),
});
export type AdminStats = z.infer<typeof adminStats>;
