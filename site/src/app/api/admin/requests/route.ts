import { isHost } from "@/lib/auth";
import { fail, guard, json } from "@/lib/api";
import { listPendingRequests } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everyone waiting to be let in.
 *
 * This is the one place an email address is returned, and it is behind Kaijsa's
 * session: she cannot decide who to admit without seeing who is asking.
 */
export async function GET(req: Request) {
  return guard(async () => {
    if (!(await isHost(req))) return fail(401, "Sign in first.");
    return json({ requests: await listPendingRequests() });
  });
}
