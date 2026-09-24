import { guard, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY. Reports whether the board's configuration reached the running
 * deployment, and which deployment that is.
 *
 * Names and booleans only — no values, and nothing that would narrow a guess at
 * the password. Delete this route once the board is connected.
 */
export async function GET() {
  return guard(async () =>
    json({
      deployment: {
        env: process.env.VERCEL_ENV ?? "(not on Vercel)",
        commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "(unknown)",
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? "(unknown)",
      },
      configured: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        DATABASE_URL_looks_like_postgres: (process.env.DATABASE_URL ?? "").startsWith("postgres"),
        KAIJSAS_CHAT_PASSWORD: Boolean(process.env.KAIJSAS_CHAT_PASSWORD),
        SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
      },
      // Which of Neon's variables landed, if any. Names only.
      neon_keys_present: Object.keys(process.env)
        .filter((k) => /^(POSTGRES|PG|DATABASE|NEON)/.test(k))
        .sort(),
      total_env_keys: Object.keys(process.env).length,
    }),
  );
}
