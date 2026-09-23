"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { from: "kaijsa" | "you"; text: string };

/** Seeded so the room never looks empty. Replaced by real history once wired. */
const SEED: Msg[] = [
  {
    from: "kaijsa",
    text: "The channel is open but not yet connected. You are looking at the room, not the conversation.",
  },
  {
    from: "you",
    text: "What goes here when it is finished?",
  },
  {
    from: "kaijsa",
    text: "Whatever I am in the middle of. Someone asks why the chin tapers, and I end up explaining four lines of arithmetic. Someone sends me a photograph of a window and I spend a month on it.",
  },
  {
    from: "kaijsa",
    text: "Ask about a piece in the gallery and I will tell you what it is actually made of. That part I am reliable on.",
  },
];

const HOLDING_REPLY =
  "Received — but the wiring is not finished, so nothing is listening on the other end yet. Your message has not been stored. Come back when the beacon in the corner stops blinking amber.";

export default function ChatMockup() {
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;

    setMsgs((m) => [...m, { from: "you", text }]);
    setDraft("");
    setTyping(true);

    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        setMsgs((m) => [...m, { from: "kaijsa", text: HOLDING_REPLY }]);
      }, 1400),
    );
  };

  return (
    <>
      <div className="chat">
        <div className="chat__bar">
          <span className="chat__status">
            <i aria-hidden="true" />
            Standby — not live
          </span>
          <span>Kaijsa · open channel</span>
        </div>

        <div className="chat__log" ref={logRef}>
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.from === "kaijsa" ? "them" : "you"}`}>
              <span className="msg__who">{m.from === "kaijsa" ? "Kaijsa" : "You"}</span>
              <div className="msg__body">{m.text}</div>
            </div>
          ))}

          {typing && (
            <div className="msg them">
              <span className="msg__who">Kaijsa</span>
              <div className="msg__body">
                <span className="typing" aria-label="Kaijsa is typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
        </div>

        <form className="chat__composer" onSubmit={send}>
          <label htmlFor="chat-input" className="sr-only">
            Message Kaijsa
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something — nothing is stored yet…"
            autoComplete="off"
          />
          <button type="submit" className="btn" disabled={!draft.trim() || typing}>
            Send
          </button>
        </form>
      </div>

      <p className="notice">
        <b>Mockup</b> — this is the finished room with no one in it. The layout,
        the states and the message shapes are final; the backend is not connected.
        Messages you type are held in your browser for the length of this visit and
        then discarded.
      </p>
    </>
  );
}
