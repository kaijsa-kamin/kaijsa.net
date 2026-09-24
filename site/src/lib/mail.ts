import nodemailer, { type Transporter } from "nodemailer";

/* ==========================================================================
   The one letter the board sends: you are on the list.

   Nothing else is ever mailed. The board does not notify, digest or remind —
   it is a room you look into, not one that shouts at you.
   ========================================================================== */

const BOARD_URL = "https://www.kaijsa.net/chat";

type Smtp = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

/**
 * Reads the SMTP settings, or null if the site has none. A board without a
 * mailbox still works — approving someone simply does not write to them.
 */
function settings(): Smtp | null {
  const host = process.env.KAIJSA_SMTP_SERVER;
  const user = process.env.KAIJSA_SMTP_USERNAME;
  const pass = process.env.KAIJSA_SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.KAIJSA_SMTP_PORT ?? 465);
  // "SSL/TLS" on 465 is implicit TLS — the socket is encrypted from the first
  // byte. STARTTLS on 587 begins in the clear and upgrades, which nodemailer
  // wants told apart by `secure`, not by the port.
  const security = (process.env.KAIJSA_SMTP_SECURITY ?? "").toUpperCase();
  const secure = security.includes("SSL") || (port === 465 && !security.includes("START"));

  return { host, port, secure, user, pass };
}

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (cached) return cached;
  const s = settings();
  if (!s) return null;
  cached = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
  });
  return cached;
}

/** Whether the site is able to send at all. */
export function mailConfigured(): boolean {
  return settings() !== null;
}

/** Opens a connection and authenticates without sending anything. */
export async function verifyMail(): Promise<boolean> {
  const t = transport();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch (err) {
    console.error("[mail] verify failed", err);
    return false;
  }
}

function fromAddress(): string {
  // The envelope sender has to be the authenticated mailbox — most servers
  // reject a From they did not issue — so the display name carries her name
  // and the address stays the account's own.
  const user = process.env.KAIJSA_SMTP_USERNAME ?? "contact@kaijsa.net";
  return `Kaijsa Kamin <${user}>`;
}

const text = (name: string) => `Hello ${name},

You are on the guest list for the board at kaijsa.net.

You can post now. Use the same name and email address you asked with:

    Name:  ${name}

Everyone who visits the board can read every message on it, and your
name appears beside anything you post. Your email address does not — it
is only how the board knows you.

${BOARD_URL}

Warm regards,
Kaijsa Kamin`;

const html = (name: string) => `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:34em">
  <p>Hello ${escape(name)},</p>
  <p>You are on the guest list for the board at kaijsa.net.</p>
  <p>You can post now. Use the same name and email address you asked with — both have to match, though capitalisation does not.</p>
  <p>Everyone who visits the board can read every message on it, and your name appears beside anything you post. Your email address does not: it is only how the board knows you.</p>
  <p><a href="${BOARD_URL}" style="color:#c2410c">${BOARD_URL}</a></p>
  <p style="margin-top:2em">Warm regards,<br>Kaijsa Kamin</p>
</div>`;

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * Tell someone they have been let in.
 *
 * Returns whether it went out. The caller must not treat false as a failed
 * approval — they are on the list either way, and a bounced notification is a
 * smaller problem than an approval that silently rolled back.
 */
export async function sendApprovalEmail(name: string, to: string): Promise<boolean> {
  const t = transport();
  if (!t) return false;
  try {
    await t.sendMail({
      from: fromAddress(),
      to,
      subject: "You are on the list",
      text: text(name),
      html: html(name),
    });
    return true;
  } catch (err) {
    console.error("[mail] send failed", err);
    return false;
  }
}
