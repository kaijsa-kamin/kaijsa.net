import { isHost } from "@/lib/auth";
import { fail, field, guard, json, readJson } from "@/lib/api";
import {
  LIMITS,
  findGuest,
  findHost,
  listMessages,
  looksLikeEmail,
  postMessage,
  recentMessageCount,
} from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The board. Public — everyone sees every message.
 *
 * Only the author's display name travels. Email addresses and the guest list
 * itself never appear in a response from this route.
 */
export async function GET() {
  return guard(async () => json({ messages: await listMessages() }));
}

/**
 * Post to the board.
 *
 * Two ways in: Kaijsa's session cookie, or a name and email that together match
 * a row on the guest list. Both parts must match — an address on the list with
 * the wrong name is refused, which is what makes the pair a credential rather
 * than just an identifier.
 */
export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson(req);
    if (!body) return fail(400, "Expected a JSON body.");

    const text = field(body, "body", LIMITS.body);
    if (!text) return fail(400, `A message must be 1–${LIMITS.body} characters.`);

    const author = (await isHost())
      ? await findHost()
      : await guestFrom(body);

    if (!author) {
      // Deliberately one message for every way of failing to be on the list:
      // wrong name, wrong address, or not a guest at all. Distinguishing them
      // would turn this route into a way to test whether an address is a guest.
      return fail(403, "That name and email are not on the guest list.");
    }

    if (await recentMessageCount(author.id) >= LIMITS.perMinute) {
      return fail(429, "Slow down a moment.");
    }

    const message = await postMessage(author.id, author.name, text);
    return json({ message }, 201);
  });
}

async function guestFrom(body: Record<string, unknown>) {
  const name = field(body, "name", LIMITS.name);
  const email = field(body, "email", LIMITS.email);
  if (!name || !email || !looksLikeEmail(email)) return null;
  return findGuest(name, email);
}
