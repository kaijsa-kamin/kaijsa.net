import { neon } from "@neondatabase/serverless";

/**
 * Creates the board's three sections and seats Kaijsa as the host.
 *
 * Safe to run more than once: every statement is guarded, and the host row is
 * inserted only if her address is not already there.
 *
 *   npm run db:setup
 *
 * Reads DATABASE_URL, and optionally HOST_NAME and HOST_EMAIL, from
 * .env.local — see README.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "Put it in site/.env.local, then run: npm run db:setup",
  );
  process.exit(1);
}

const sql = neon(url);

const HOST_NAME = process.env.HOST_NAME ?? "Kaijsa";
const HOST_EMAIL = (process.env.HOST_EMAIL ?? "kajsa@webinno.io").toLowerCase();

/* -------------------------------------------------------------- the guests */

await sql`
  create table if not exists guests (
    id          bigint generated always as identity primary key,
    name        text        not null,
    email       text        not null unique,
    is_host     boolean     not null default false,
    created_at  timestamptz not null default now()
  )
`;

// Names are matched case-insensitively when someone posts, so the lookup wants
// an index it can actually use.
await sql`create index if not exists guests_name_lower on guests (lower(name))`;

/* ------------------------------------------------------------- the asking */

await sql`
  create table if not exists join_requests (
    id          bigint generated always as identity primary key,
    name        text        not null,
    email       text        not null,
    note        text,
    status      text        not null default 'pending',
    created_at  timestamptz not null default now(),
    decided_at  timestamptz,
    constraint join_requests_status check (status in ('pending', 'approved', 'rejected'))
  )
`;

// One pending request per address. This is what makes the route's
// "on conflict do nothing" fold repeat submissions into the first, so that
// asking twice tells the asker nothing.
await sql`
  create unique index if not exists join_requests_one_pending
  on join_requests (email) where status = 'pending'
`;

/* --------------------------------------------------------------- the board */

await sql`
  create table if not exists messages (
    id          bigint generated always as identity primary key,
    guest_id    bigint      references guests (id) on delete set null,
    author_name text        not null,
    body        text        not null,
    created_at  timestamptz not null default now()
  )
`;

// The board is read newest-first and then reversed, and rate limiting counts a
// guest's recent rows; both want this.
await sql`create index if not exists messages_chronological on messages (created_at desc, id desc)`;
await sql`create index if not exists messages_by_guest on messages (guest_id, created_at desc)`;

/* ----------------------------------------------------------------- the host */

await sql`
  insert into guests (name, email, is_host)
  values (${HOST_NAME}, ${HOST_EMAIL}, true)
  on conflict (email) do update set is_host = true, name = excluded.name
`;

const [{ guests, requests, messages }] = await sql`
  select
    (select count(*)::int from guests)                              as guests,
    (select count(*)::int from join_requests where status='pending') as requests,
    (select count(*)::int from messages)                            as messages
`;

console.log(`schema ready — ${guests} guest(s), ${requests} pending, ${messages} message(s)`);
console.log(`host: ${HOST_NAME} <${HOST_EMAIL}>`);
