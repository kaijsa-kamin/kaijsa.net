import { fail, field, guard, json, readJson } from "@/lib/api";
import { LIMITS, createJoinRequest, isGuest, looksLikeEmail } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ask to be let onto the board. Kaijsa decides.
 *
 * The reply is the same whether the request was filed, was a duplicate, or came
 * from an address that is already a guest. Anything else would let a stranger
 * use this route to find out who is on the list.
 */
export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson(req);
    if (!body) return fail(400, "Expected a JSON body.");

    const name = field(body, "name", LIMITS.name);
    const email = field(body, "email", LIMITS.email);
    const note = field(body, "note", LIMITS.note);

    if (!name) return fail(400, `A name must be 1–${LIMITS.name} characters.`);
    if (!email || !looksLikeEmail(email)) return fail(400, "That does not look like an email address.");

    if (!(await isGuest(email))) {
      await createJoinRequest(name, email, note);
    }

    return json({ ok: true, message: "Sent. Kaijsa will decide." }, 202);
  });
}
