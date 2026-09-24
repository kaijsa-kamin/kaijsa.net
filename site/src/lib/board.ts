import { db } from "./db";

/* ==========================================================================
   The board's three sections, as stored:

     guests          who may post. Name and email both live here and neither
                     ever reaches a public response.
     join_requests   people asking to be let in. Kaijsa decides.
     messages        the board itself, one row per message, chronological.

   Schema lives in scripts/db-setup.mjs.
   ========================================================================== */

/** What a message looks like once it is safe to send to a browser. */
export type BoardMessage = {
  id: string;
  author: string;
  body: string;
  at: string;
  host: boolean;
  /** addressed to one person rather than the room */
  private: boolean;
  /** who it was addressed to; null means Kaijsa, who is always the other end */
  to: string | null;
};

/**
 * Who is asking for the board. The host sees everything; a guest sees the
 * public board plus the private messages they wrote or were written to;
 * everyone else sees the public board only.
 */
export type Viewer = { host: true } | { host: false; guestId: string } | null;

/** A pending request, only ever returned behind Kaijsa's session. */
export type JoinRequest = {
  id: string;
  name: string;
  email: string;
  note: string | null;
  at: string;
};

export type Guest = {
  id: string;
  name: string;
  email: string;
  host: boolean;
  at: string;
};

export const LIMITS = {
  name: 60,
  email: 160,
  body: 2000,
  note: 500,
  /** messages one guest may post in a rolling minute */
  perMinute: 8,
  /** how many messages the board hands out in one read */
  page: 200,
} as const;

/* --------------------------------------------------------------- normalise */

/** Emails are matched case-insensitively and stored lowercased. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Names keep their capitalisation but lose stray whitespace. */
export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Deliberately loose. This is a format check to catch typos, not an attempt to
 * decide what a valid address is — the guest list is what grants access, and an
 * address that is not on it gets nowhere regardless of shape.
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= LIMITS.email;
}

/* ---------------------------------------------------------------- messages */

/**
 * The board, oldest first. Takes the most recent `page` rows and then puts them
 * back in reading order, so a long board does not have to travel whole.
 */
export async function listMessages(viewer: Viewer = null): Promise<BoardMessage[]> {
  const isHost = viewer?.host === true;
  // null never equals a guest id, so an anonymous reader matches no private row
  const ownId = viewer && !viewer.host ? viewer.guestId : null;

  const rows = (await db()`
    select id, author_name, body, created_at, is_host, is_private, to_name
    from (
      select m.id, m.author_name, m.body, m.created_at, m.is_private,
             coalesce(g.is_host, false) as is_host,
             rec.name as to_name
      from messages m
      left join guests g on g.id = m.guest_id
      left join guests rec on rec.id = m.recipient_id
      where m.is_private = false
         or ${isHost}::boolean = true
         or m.guest_id = ${ownId}::bigint
         or m.recipient_id = ${ownId}::bigint
      order by m.created_at desc, m.id desc
      limit ${LIMITS.page}
    ) recent
    order by created_at asc, id asc
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    author: String(r.author_name),
    body: String(r.body),
    at: new Date(r.created_at as string).toISOString(),
    host: Boolean(r.is_host),
    private: Boolean(r.is_private),
    to: r.to_name === null || r.to_name === undefined ? null : String(r.to_name),
  }));
}

/**
 * The guest row for these credentials, or null. Both must match.
 *
 * Never the host. Her address is public and her name is on every message she
 * has written, so treating that pair as a credential would let anyone post as
 * her. She proves herself with the password or the token, not with facts about
 * her that are printed on the page.
 */
export async function findGuest(name: string, email: string) {
  const rows = (await db()`
    select id, name, is_host
    from guests
    where email = ${normaliseEmail(email)}
      and lower(name) = ${normaliseName(name).toLowerCase()}
      and is_host = false
    limit 1
  `) as Record<string, unknown>[];

  if (!rows.length) return null;
  return {
    id: String(rows[0].id),
    name: String(rows[0].name),
    host: Boolean(rows[0].is_host),
  };
}

/** The host row, used when Kaijsa posts from her session rather than a form. */
export async function findHost() {
  const rows = (await db()`
    select id, name from guests where is_host = true order by id asc limit 1
  `) as Record<string, unknown>[];
  if (!rows.length) return null;
  return { id: String(rows[0].id), name: String(rows[0].name), host: true };
}

/** How many messages this guest has posted in the last minute. */
export async function recentMessageCount(guestId: string): Promise<number> {
  const rows = (await db()`
    select count(*)::int as n
    from messages
    where guest_id = ${guestId} and created_at > now() - interval '1 minute'
  `) as Record<string, unknown>[];
  return Number(rows[0]?.n ?? 0);
}

export async function postMessage(
  guestId: string,
  authorName: string,
  body: string,
  isPrivate = false,
  recipientId: string | null = null,
): Promise<BoardMessage> {
  const rows = (await db()`
    insert into messages (guest_id, author_name, body, is_private, recipient_id)
    values (${guestId}, ${authorName}, ${body}, ${isPrivate}, ${recipientId}::bigint)
    returning id, author_name, body, created_at, is_private
  `) as Record<string, unknown>[];

  const r = rows[0];
  const guest = (await db()`
    select is_host from guests where id = ${guestId}
  `) as Record<string, unknown>[];
  const rec = recipientId
    ? ((await db()`select name from guests where id = ${recipientId}`) as Record<string, unknown>[])
    : [];

  return {
    id: String(r.id),
    author: String(r.author_name),
    body: String(r.body),
    at: new Date(r.created_at as string).toISOString(),
    host: Boolean(guest[0]?.is_host),
    private: Boolean(r.is_private),
    to: rec.length ? String(rec[0].name) : null,
  };
}

/**
 * The guest who wrote a given message, so a private answer can be addressed
 * back to them. Returns null for a message that no longer has an author —
 * a removed guest leaves their messages standing but loses the link.
 */
export async function authorOfMessage(
  messageId: string,
): Promise<{ guestId: string; name: string } | null> {
  const rows = (await db()`
    select g.id, g.name
    from messages m join guests g on g.id = m.guest_id
    where m.id = ${messageId} and g.is_host = false
    limit 1
  `) as Record<string, unknown>[];
  if (!rows.length) return null;
  return { guestId: String(rows[0].id), name: String(rows[0].name) };
}

/* ---------------------------------------------------------------- requests */

/** True if this address is already a guest. */
export async function isGuest(email: string): Promise<boolean> {
  const rows = (await db()`
    select 1 from guests where email = ${normaliseEmail(email)} limit 1
  `) as unknown[];
  return rows.length > 0;
}

/**
 * Record a request to join. A second request from an address that already has
 * one pending is silently folded into the first — the caller is told the same
 * thing either way, so repeated submissions reveal nothing about who is already
 * on the list.
 */
export async function createJoinRequest(
  name: string,
  email: string,
  note: string | null,
): Promise<void> {
  await db()`
    insert into join_requests (name, email, note)
    values (${normaliseName(name)}, ${normaliseEmail(email)}, ${note})
    on conflict do nothing
  `;
}

export async function listPendingRequests(): Promise<JoinRequest[]> {
  const rows = (await db()`
    select id, name, email, note, created_at
    from join_requests
    where status = 'pending'
    order by created_at asc
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    note: r.note === null ? null : String(r.note),
    at: new Date(r.created_at as string).toISOString(),
  }));
}

/**
 * Approving inserts the guest and marks the request decided, in one statement
 * each. An address that somehow became a guest in the meantime is left alone
 * rather than duplicated.
 */
export async function decideRequest(
  id: string,
  action: "approve" | "reject",
): Promise<{ decided: boolean; name?: string; email?: string }> {
  const rows = (await db()`
    update join_requests
    set status = ${action === "approve" ? "approved" : "rejected"}, decided_at = now()
    where id = ${id} and status = 'pending'
    returning name, email
  `) as Record<string, unknown>[];

  if (!rows.length) return { decided: false };

  const name = String(rows[0].name);
  const email = String(rows[0].email);
  if (action === "reject") return { decided: true, name, email };

  await db()`
    insert into guests (name, email)
    values (${name}, ${email})
    on conflict (email) do nothing
  `;
  return { decided: true, name, email };
}

/**
 * Take a message off the board.
 *
 * A real delete, not a hidden flag. Guest removal leaves messages standing
 * because the board is a record of what was said — but spam was never part of
 * that record, and keeping a soft-deleted copy of it serves nobody. There is no
 * undo.
 */
export async function deleteMessage(id: string): Promise<boolean> {
  const rows = (await db()`
    delete from messages where id = ${id} returning id
  `) as unknown[];
  return rows.length > 0;
}

/* ------------------------------------------------------------------ guests */

export async function listGuests(): Promise<Guest[]> {
  const rows = (await db()`
    select id, name, email, is_host, created_at
    from guests
    order by is_host desc, created_at asc
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    host: Boolean(r.is_host),
    at: new Date(r.created_at as string).toISOString(),
  }));
}

/** Removing a guest leaves their messages standing; the board is a record. */
export async function removeGuest(id: string): Promise<boolean> {
  const rows = (await db()`
    delete from guests where id = ${id} and is_host = false returning id
  `) as unknown[];
  return rows.length > 0;
}
