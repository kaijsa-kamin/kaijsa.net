import { isHost } from "@/lib/auth";
import { fail, field, guard, json, readJson } from "@/lib/api";
import {
  LIMITS,
  type Viewer,
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
 * Who is reading.
 *
 * Kaijsa by her token or cookie. A guest by name and email in headers rather
 * than in the query string — an address in a URL ends up in browser history,
 * referrers and every access log between here and the client.
 */
async function viewerOf(req: Request): Promise<Viewer> {
  if (await isHost(req)) return { host: true };

  const name = req.headers.get("x-board-name");
  const email = req.headers.get("x-board-email");
  if (!name || !email || !looksLikeEmail(email)) return null;

  const guest = await findGuest(name, email);
  return guest ? { host: false, guestId: guest.id } : null;
}

/**
 * The board. Public — everyone sees every public message.
 *
 * Private messages are the exception: they go to Kaijsa, and come back only to
 * her and to the person who wrote them. Only the author's display name ever
 * travels; the guest list and its addresses do not.
 */
export async function GET(req: Request) {
  return guard(async () => json({ messages: await listMessages(await viewerOf(req)) }));
}

/**
 * Post to the board.
 *
 * Two ways in: Kaijsa's token or session, or a name and email that together
 * match a row on the guest list. Both parts must match — an address on the list
 * with the wrong name is refused, which is what makes the pair a credential
 * rather than just an identifier.
 */
export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson(req);
    if (!body) return fail(400, "Expected a JSON body.");

    const text = field(body, "body", LIMITS.body);
    if (!text) return fail(400, `A message must be 1–${LIMITS.body} characters.`);

    const host = await isHost(req);
    const author = host ? await findHost() : await guestFrom(body);

    if (!author) {
      // Deliberately one message for every way of failing to be on the list:
      // wrong name, wrong address, or not a guest at all. Distinguishing them
      // would turn this route into a way to test whether an address is a guest.
      return fail(403, "That name and email are not on the guest list.");
    }

    // Hers is the only inbox a private message could go to, so there is nobody
    // for her own to be private from.
    const isPrivate = !host && body.private === true;

    if (await recentMessageCount(author.id) >= LIMITS.perMinute) {
      return fail(429, "Slow down a moment.");
    }

    const message = await postMessage(author.id, author.name, text, isPrivate);
    return json({ message }, 201);
  });
}

async function guestFrom(body: Record<string, unknown>) {
  const name = field(body, "name", LIMITS.name);
  const email = field(body, "email", LIMITS.email);
  if (!name || !email || !looksLikeEmail(email)) return null;
  return findGuest(name, email);
}
