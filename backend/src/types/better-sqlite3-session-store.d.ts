declare module 'better-sqlite3-session-store' {
  import session from 'express-session';
  import BetterSqlite3 from 'better-sqlite3';

  interface SqliteStoreOptions {
    client: BetterSqlite3.Database;
    expired?: {
      clear?: boolean;
      intervalMs?: number;
    };
  }

  function SqliteStore(
    session: typeof import('express-session'),
  ): new (options: SqliteStoreOptions) => session.Store;

  export = SqliteStore;
}