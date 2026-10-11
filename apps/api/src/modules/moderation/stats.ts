import type { AdminStats } from '@buddy/shared';
import { sql } from 'drizzle-orm';

import type { Db } from '../../db/client';

/** Days are counted in Sri Lanka time, where everyone using Buddy is. */
const TZ = 'Asia/Colombo';

/** Admin → Dashboard: a handful of counts, each one query. */
export async function adminStats(db: Db): Promise<AdminStats> {
  const one = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query))[0] as T;

  const [people, activities, showUp, communities, chat, daily] = await Promise.all([
    one<AdminStats['people']>(sql`
      select
        count(*)::int as total,
        count(*) filter (where u.created_at > now() - interval '7 days')::int as "new7",
        count(*) filter (where u.created_at > now() - interval '30 days')::int as "new30",
        (select count(distinct s.user_id) from session s
          where s.updated_at > now() - interval '7 days')::int as "active7",
        count(p.onboarded_at)::int as onboarded
      from "user" u left join profiles p on p.user_id = u.id`),
    one<AdminStats['activities']>(sql`
      with sized as (
        select a.*, (select count(*) from activity_members m where m.activity_id = a.id) as going
        from activities a
      )
      select
        count(*) filter (where starts_at > now() and cancelled_at is null)::int as upcoming,
        count(*) filter (where created_at > now() - interval '7 days')::int as "created7",
        count(*) filter (where created_at > now() - interval '30 days')::int as "created30",
        count(*) filter (where starts_at <= now() and starts_at > now() - interval '30 days'
          and cancelled_at is null)::int as "happened30",
        coalesce(round(avg(going) filter (where starts_at <= now()
          and starts_at > now() - interval '30 days' and cancelled_at is null), 1), 0)::float
          as "avgGoing30",
        count(*) filter (where starts_at <= now() and starts_at > now() - interval '30 days'
          and cancelled_at is null and going >= capacity)::int as "filled30",
        count(*) filter (where cancelled_at > now() - interval '30 days')::int as "cancelled30"
      from sized`),
    one<AdminStats['showUp']>(sql`
      select count(m.attended)::int as marked,
        count(*) filter (where m.attended)::int as came
      from activity_members m join activities a on a.id = m.activity_id
      where a.starts_at > now() - interval '30 days'`),
    one<AdminStats['communities']>(sql`
      select count(*)::int as total,
        count(*) filter (where created_at > now() - interval '30 days')::int as "new30"
      from communities`),
    one<{ messages7: number; openReports: number }>(sql`
      select
        (select count(*) from messages where kind = 'user'
          and created_at > now() - interval '7 days')::int as "messages7",
        (select count(*) from reports where status = 'open')::int as "openReports"`),
    db.execute<{ day: string; signups: number; activities: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        (select count(*) from "user" u
          where (u.created_at at time zone ${TZ})::date = d)::int as signups,
        (select count(*) from activities a
          where (a.created_at at time zone ${TZ})::date = d)::int as activities
      from generate_series((now() at time zone ${TZ})::date - 13,
        (now() at time zone ${TZ})::date, interval '1 day') d
      order by d`),
  ]);

  return {
    people,
    activities,
    showUp,
    communities,
    messages7: chat.messages7,
    openReports: chat.openReports,
    daily: [...daily],
  };
}
