import { isHost } from "@/lib/auth";
import { fail, guard, json } from "@/lib/api";
import { removeGuest } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Take someone off the list. Their messages stay: the board is a record. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/guests/[id]">) {
  return guard(async () => {
    if (!(await isHost(req))) return fail(401, "Sign in first.");
    const { id } = await ctx.params;
    const removed = await removeGuest(id);
    if (!removed) return fail(404, "No such guest.");
    return json({ ok: true });
  });
}
