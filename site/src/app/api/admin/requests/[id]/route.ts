import { isHost } from "@/lib/auth";
import { fail, guard, json, readJson } from "@/lib/api";
import { decideRequest } from "@/lib/board";
import { mailConfigured, sendApprovalEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Approve or reject one request. Approving adds the guest. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/requests/[id]">) {
  return guard(async () => {
    if (!(await isHost(req))) return fail(401, "Sign in first.");

    const { id } = await ctx.params;
    const body = await readJson(req);
    const action = body?.action;
    if (action !== "approve" && action !== "reject") {
      return fail(400, 'action must be "approve" or "reject".');
    }

    const { decided, name, email } = await decideRequest(id, action);
    if (!decided) return fail(404, "No pending request with that id.");

    // The letter goes out after the row is written, and its failure is
    // reported rather than thrown: they are on the list either way, and an
    // approval that rolled back because a mail server was down would be worse
    // than one that went through quietly.
    let emailed: boolean | null = null;
    if (action === "approve" && email) {
      emailed = mailConfigured() ? await sendApprovalEmail(name!, email) : null;
    }

    return json({ ok: true, action, emailed });
  });
}
