import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/* ==========================================================================
   Kaijsa's side of the board.

   One password, held in KAIJSAS_CHAT_PASSWORD, never in the repo. Logging in
   sets a signed, http-only cookie; nothing about the session is stored, so
   there is no session table to leak and changing the password invalidates
   every outstanding cookie at once.
   ========================================================================== */

const COOKIE = "kaijsa_host";
const TTL_MS = 12 * 60 * 60 * 1000;

class NoPassword extends Error {
  constructor() {
    super("KAIJSAS_CHAT_PASSWORD is not set");
    this.name = "NoPassword";
  }
}

function hostPassword(): string {
  const p = process.env.KAIJSAS_CHAT_PASSWORD;
  if (!p) throw new NoPassword();
  return p;
}

/**
 * What a bearer token is checked against. A dedicated KAIJSA_BOARD_TOKEN if one
 * is set, so the machine credential can be rotated without logging her out of
 * the browser; otherwise the password itself, so the header route works with no
 * extra configuration.
 */
function bearerSecret(): string {
  return process.env.KAIJSA_BOARD_TOKEN || hostPassword();
}

/** Constant-time compare of two strings of any length. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Signing key. SESSION_SECRET if one is set, otherwise derived from the
 * password — which means a password change logs her out everywhere, and there
 * is only one secret to configure.
 */
function secret(): Buffer {
  const explicit = process.env.SESSION_SECRET;
  if (explicit) return Buffer.from(explicit, "utf8");
  return scryptSync(hostPassword(), "kaijsa-board-session", 32);
}

/**
 * Constant-time password check. Both sides are hashed first so the comparison
 * is over fixed-length buffers — timingSafeEqual throws on a length mismatch,
 * and the mismatch itself would leak the password's length.
 */
export function verifyHostPassword(input: string): boolean {
  let expected: string;
  try {
    expected = hostPassword();
  } catch {
    return false;
  }
  return sameSecret(input, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function mintToken(): string {
  const expires = String(Date.now() + TTL_MS);
  return `${expires}.${sign(expires)}`;
}

function tokenIsValid(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;

  const expires = token.slice(0, dot);
  const given = token.slice(dot + 1);

  let wanted: string;
  try {
    wanted = sign(expires);
  } catch {
    return false;
  }

  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const at = Number(expires);
  return Number.isFinite(at) && at > Date.now();
}

export async function startHostSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, mintToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endHostSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * Whether this request is Kaijsa.
 *
 * Two ways to be: a live session cookie, which is what the browser uses, or an
 * `Authorization: Bearer <token>` header, which is what she uses. The header
 * needs no session and no round trip, so a script can approve someone in one
 * call instead of three.
 */
export async function isHost(req?: Request): Promise<boolean> {
  const header = req?.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const given = header.slice(7).trim();
    try {
      if (given && sameSecret(given, bearerSecret())) return true;
    } catch {
      // no password configured; fall through to the cookie
    }
  }

  const jar = await cookies();
  return tokenIsValid(jar.get(COOKIE)?.value);
}
