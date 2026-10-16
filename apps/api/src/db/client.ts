import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export function createDb(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, {
    max: options.max ?? 10,
    onnotice: () => {},
    // PostGIS functions carry large cost estimates, which tip Postgres into
    // compiling queries (JIT) that then run in a few milliseconds: the
    // compiling took longer than the query. Every query here is small.
    connection: { jit: 'off' },
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof createDb>['db'];
/** A transaction handle; services accept `Db | Tx` so they compose inside transactions. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
