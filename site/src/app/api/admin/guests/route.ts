import { isHost } from "@/lib/auth";
import { fail, guard, json } from "@/lib/api";
import { listGuests } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The guest list itself. Never reachable without a host session. */
export async function GET() {
  return guard(async () => {
    if (!(await isHost())) return fail(401, "Sign in first.");
    return json({ guests: await listGuests() });
  });
}
