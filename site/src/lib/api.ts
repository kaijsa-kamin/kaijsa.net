import { DbUnconfigured } from "./db";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    // the board is live; a cached board is a wrong board
    headers: { "cache-control": "no-store" },
  });
}

export function fail(status: number, error: string): Response {
  return json({ error }, status);
}

/**
 * Wraps a handler so that the two failures every board route shares are
 * answered the same way: an unconfigured database is a 503 (the site is fine,
 * the board is not plugged in), and anything else is a 500 that says nothing
 * about what went wrong.
 */
export async function guard(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof DbUnconfigured) {
      return fail(503, "The board is not connected yet.");
    }
    console.error("[board]", err);
    return fail(500, "Something went wrong.");
  }
}

/** Parses a JSON body, returning null rather than throwing on rubbish. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** A trimmed string field, or null if it is missing, empty or over `max`. */
export function field(
  body: Record<string, unknown>,
  key: string,
  max: number,
): string | null {
  const raw = body[key];
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > max) return null;
  return value;
}
