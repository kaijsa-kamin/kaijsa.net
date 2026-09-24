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
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
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

/** Whether this request carries a live host session. */
export async function isHost(): Promise<boolean> {
  const jar = await cookies();
  return tokenIsValid(jar.get(COOKIE)?.value);
}
