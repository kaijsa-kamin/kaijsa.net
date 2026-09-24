import { createHash } from "node:crypto";
import { fail, field, guard, json, readJson } from "@/lib/api";
import {
  LIMITS,
  createJoinRequest,
  isGuest,
  looksLikeEmail,
  pendingCount,
  recentAskCount,
} from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a request came from, as a salted hash.
 *
 * Enough to tell one flood from many separate people, not enough to be a log
 * of who visited: the hash cannot be read back into an address, and without the
 * salt it cannot be checked against a guess either.
 */
function origin(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  if (!ip) return null;
  const salt = process.env.SESSION_SECRET ?? process.env.KAIJSAS_CHAT_PASSWORD ?? "kaijsa";
  return createHash("sha256").update(`${salt}:${ip}`).digest("base64url").slice(0, 32);
}

/**
 * Ask to be let onto the board. Kaijsa decides.
 *
 * The reply is the same whether the request was filed, was a duplicate, or came
 * from an address that is already a guest. Anything else would let a stranger
 * use this route to find out who is on the list.
 *
 * It is the one door on the site that opens to anyone, so it is also the one
 * worth flooding: unguarded, it took twenty rows in five seconds and would have
 * taken as many as anyone cared to send.
 */
export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson(req);
    if (!body) return fail(400, "Expected a JSON body.");

    // A field no person can see and no person fills in. Answer as if it went
    // through, so a bot has nothing to learn from being turned away.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return json({ ok: true, message: "Sent. Kaijsa will decide." }, 202);
    }

    const name = field(body, "name", LIMITS.name);
    const email = field(body, "email", LIMITS.email);
    const note = field(body, "note", LIMITS.note);

    if (!name) return fail(400, `A name must be 1–${LIMITS.name} characters.`);
    if (!email || !looksLikeEmail(email)) return fail(400, "That does not look like an email address.");

    // Said plainly rather than silently dropped: this one leaks nothing about
    // who is on the list, only that this caller is asking too often.
    const from = origin(req);
    if (from && (await recentAskCount(from)) >= LIMITS.asksPerHour) {
      return fail(429, "That is a lot of asking. Try again in an hour.");
    }

    // A queue nobody can read is a queue nobody can act on, so it has an end.
    if ((await pendingCount()) >= LIMITS.queue) {
      return fail(503, "The list is closed for now. Try again later.");
    }

    if (!(await isGuest(email))) {
      await createJoinRequest(name, email, note, from);
    }

    return json({ ok: true, message: "Sent. Kaijsa will decide." }, 202);
  });
}
