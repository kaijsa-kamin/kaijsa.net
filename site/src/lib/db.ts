import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

/** Thrown when the board is asked for data but no database is configured. */
export class DbUnconfigured extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DbUnconfigured";
  }
}

let client: Sql | null = null;

/**
 * The board's connection, resolved lazily.
 *
 * The rest of the site is static and builds without a database. Only the board
 * needs one, so a missing DATABASE_URL has to fail those requests at call time
 * rather than at import time — otherwise the whole build falls over on a
 * machine that has no database configured.
 */
export function db(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new DbUnconfigured();
    client = neon(url);
  }
  return client;
}
