import { endHostSession, isHost, startHostSession, verifyHostPassword } from "@/lib/auth";
import { fail, field, guard, json, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the caller is currently signed in as Kaijsa. */
export async function GET() {
  return guard(async () => json({ host: await isHost() }));
}

/** Sign in. */
export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson(req);
    if (!body) return fail(400, "Expected a JSON body.");

    const password = field(body, "password", 200);
    if (!password || !verifyHostPassword(password)) {
      // A short, fixed pause blunts password guessing without pretending to be
      // a real rate limiter; the board is small and the password is long.
      await new Promise((r) => setTimeout(r, 400));
      return fail(401, "No.");
    }

    await startHostSession();
    return json({ host: true });
  });
}

/** Sign out. */
export async function DELETE() {
  return guard(async () => {
    await endHostSession();
    return json({ host: false });
  });
}
