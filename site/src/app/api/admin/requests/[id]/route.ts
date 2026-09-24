import { isHost } from "@/lib/auth";
import { fail, guard, json, readJson } from "@/lib/api";
import { decideRequest } from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Approve or reject one request. Approving adds the guest. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/requests/[id]">) {
  return guard(async () => {
    if (!(await isHost())) return fail(401, "Sign in first.");

    const { id } = await ctx.params;
    const body = await readJson(req);
    const action = body?.action;
    if (action !== "approve" && action !== "reject") {
      return fail(400, 'action must be "approve" or "reject".');
    }

    const decided = await decideRequest(id, action);
    if (!decided) return fail(404, "No pending request with that id.");
    return json({ ok: true, action });
  });
}
