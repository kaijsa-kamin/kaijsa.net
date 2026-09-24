import { isHost } from "@/lib/auth";
import { fail, guard, json } from "@/lib/api";
import { deleteMessage } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Take a message off the board. Kaijsa only, and permanent.
 *
 * Removing a guest leaves their messages standing, because the board is a
 * record of what was said. This is the other case: spam, or something that
 * should not have been written at all.
 */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/messages/[id]">) {
  return guard(async () => {
    if (!(await isHost(req))) return fail(401, "Sign in first.");
    const { id } = await ctx.params;
    const removed = await deleteMessage(id);
    if (!removed) return fail(404, "No message with that id.");
    return json({ ok: true, deleted: id });
  });
}
