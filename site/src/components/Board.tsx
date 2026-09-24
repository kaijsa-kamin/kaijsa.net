"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HostPanel from "./HostPanel";

type Message = {
  id: string;
  author: string;
  body: string;
  at: string;
  host: boolean;
  private: boolean;
  to: string | null;
};

type Identity = { name: string; email: string };

const STORE = "kaijsa.board.identity";
const POLL_MS = 12_000;

/**
 * Who you are, kept on your own machine so the board does not have to ask every
 * visit. It is only ever sent to the board's own API, and the address never
 * comes back down — the board returns names, nothing else.
 */
function loadIdentity(): Identity | null {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.name === "string" && typeof v?.email === "string") return v;
  } catch {
    // private windows and blocked site data both land here; the board still works
  }
  return null;
}

function saveIdentity(id: Identity | null) {
  try {
    if (id) window.localStorage.setItem(STORE, JSON.stringify(id));
    else window.localStorage.removeItem(STORE);
  } catch {
    /* nothing to do — the board falls back to asking each time */
  }
}

/**
 * What the badge on a private message says, from where you are standing.
 * A private message has two readers and the label should tell you which of
 * them you are — "private" alone leaves you guessing whether anyone else
 * can see it.
 */
function privateLabel(m: Message, host: boolean, me: string | undefined): string {
  if (m.host) return host ? `private to ${m.to ?? "someone"}` : "private to you";
  if (host) return "private to you";
  const mine = me && m.author.toLowerCase() === me.toLowerCase();
  return mine ? "private to Kaijsa" : "private";
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Board() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const [host, setHost] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    const saved = loadIdentity();
    if (saved) {
      setIdentity(saved);
      setName(saved.name);
      setEmail(saved.email);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const who = loadIdentity();
      const res = await fetch("/api/board/messages", {
        cache: "no-store",
        // in headers, not the query string: an address in a URL survives in
        // history, referrers and every access log on the way
        headers: who ? { "x-board-name": who.name, "x-board-email": who.email } : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setOffline(data.error ?? "The board is unreachable.");
        return;
      }
      setOffline(null);
      setMessages(data.messages);
    } catch {
      setOffline("The board is unreachable.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  // Follow the bottom only when the reader is already there — yanking the view
  // down while someone is reading older messages is worse than a missed one.
  useEffect(() => {
    const el = logRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    const who = host ? null : identity ?? { name: name.trim(), email: email.trim() };
    if (!host && (!who?.name || !who?.email)) {
      setNotice("Both your name and your email, please.");
      return;
    }

    setSending(true);
    setNotice(null);
    setShowJoin(false);

    try {
      const res = await fetch("/api/board/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(who ? { ...who, body, private: isPrivate } : { body }),
      });
      const data = await res.json();

      if (res.status === 403) {
        setShowJoin(true);
        setNotice(data.error);
        return;
      }
      if (!res.ok) {
        setNotice(data.error ?? "That did not go through.");
        return;
      }

      if (who) {
        setIdentity(who);
        saveIdentity(who);
      }
      setDraft("");
      setIsPrivate(false);
      atBottom.current = true;
      setMessages((m) => (m ? [...m, data.message] : [data.message]));
    } catch {
      setNotice("That did not go through.");
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || offline !== null;

  return (
    <>
      <div className="chat">
        <div className="chat__bar">
          <span className="chat__status">
            <i aria-hidden="true" className={offline ? "is-off" : ""} />
            {offline ? "Board unreachable" : "The board is open"}
          </span>
          <span>{host ? "Signed in as Kaijsa" : "Public unless marked private"}</span>
        </div>

        <div className="chat__log" ref={logRef} onScroll={onScroll}>
          {messages === null && !offline && <p className="board__empty">Reading the board…</p>}
          {offline && (
            <p className="board__empty">
              {offline}
              <br />
              Posting and joining are both off until it is.
            </p>
          )}
          {messages?.length === 0 && (
            <p className="board__empty">Nothing on the board yet. Be the first.</p>
          )}

          {messages?.map((m) => {
            const mine = !m.host && identity?.name.toLowerCase() === m.author.toLowerCase();
            return (
              <div
                key={m.id}
                className={`msg board__msg ${m.host ? "is-host" : mine ? "is-mine" : ""}${
                  m.private ? " is-private" : ""
                }`}
              >
                <span className="msg__who">
                  {m.author}
                  <time dateTime={m.at}>{when(m.at)}</time>
                  {m.private && (
                    <em className="msg__private">
                      {privateLabel(m, host, identity?.name)}
                    </em>
                  )}
                </span>
                <div className="msg__body">{m.body}</div>
              </div>
            );
          })}
        </div>

        <form className="chat__composer board__composer" onSubmit={send}>
          {!host && !identity && (
            <div className="board__who">
              <label className="sr-only" htmlFor="board-name">
                Your name
              </label>
              <input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                autoComplete="name"
                maxLength={60}
                disabled={disabled}
              />
              <label className="sr-only" htmlFor="board-email">
                Your email
              </label>
              <input
                id="board-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                maxLength={160}
                disabled={disabled}
              />
            </div>
          )}

          <div className="board__say">
            <label htmlFor="board-body" className="sr-only">
              Your message
            </label>
            <input
              id="board-body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={host ? "Answer as Kaijsa…" : "Say something to the board…"}
              autoComplete="off"
              maxLength={2000}
              disabled={disabled}
            />
            <button type="submit" className="btn" disabled={disabled || !draft.trim()}>
              {sending ? "…" : "Post"}
            </button>
          </div>

          {!host && (
            <label className="board__private">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={disabled}
              />
              Private — only Kaijsa sees this
            </label>
          )}

          {identity && !host && (
            <p className="board__as">
              Posting as <b>{identity.name}</b>.{" "}
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setIdentity(null);
                  saveIdentity(null);
                  setName("");
                  setEmail("");
                }}
              >
                Not you?
              </button>
            </p>
          )}

          {notice && <p className="board__notice">{notice}</p>}

          {!host && !showJoin && (
            <p className="board__as">
              Not on the guest list?{" "}
              <button type="button" className="linklike" onClick={() => setShowJoin(true)}>
                Ask to join
              </button>
            </p>
          )}
        </form>
      </div>

      {showJoin && !host && (
        <JoinForm name={name || identity?.name || ""} email={email || identity?.email || ""} />
      )}

      <HostPanel host={host} onHostChange={setHost} />
    </>
  );
}

/* ------------------------------------------------------------------- join */

function JoinForm({ name: initialName, email: initialEmail }: { name: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/board/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That did not go through.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("That did not go through.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p className="notice">
        <b>Asked.</b> Kaijsa decides who is on the list. If she lets you in, the
        same name and email will work here.
      </p>
    );
  }

  return (
    <form className="board__join" onSubmit={ask}>
      <p className="eyebrow">Ask to join</p>
      <p>
        The board is a guest list. Leave your name and email and Kaijsa will
        decide — she is the only one who can add you.
      </p>
      <div className="board__who">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoComplete="name"
          maxLength={60}
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          maxLength={160}
          required
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you want to say first (optional)"
        maxLength={500}
      />
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Ask"}
      </button>
      {error && <p className="board__notice">{error}</p>}
    </form>
  );
}
