"use client";

import { useCallback, useEffect, useState } from "react";

type JoinRequest = {
  id: string;
  name: string;
  email: string;
  note: string | null;
  at: string;
};

/**
 * Kaijsa's side of the board: sign in, see who is asking, decide.
 *
 * Deliberately a plain link rather than a nav item. Everyone can see that the
 * door exists — the password is what keeps it shut, not the fact that the
 * handle is hidden.
 */
export default function HostPanel({
  host,
  onHostChange,
}: {
  host: boolean;
  onHostChange: (host: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);

  // A live session survives a reload, so ask the server rather than assuming.
  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.host) {
          onHostChange(true);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, [onHostChange]);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/admin/requests", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setRequests(data.requests);
  }, []);

  useEffect(() => {
    if (host) loadRequests();
  }, [host, loadRequests]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("No.");
        return;
      }
      setPassword("");
      onHostChange(true);
    } catch {
      setError("That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    onHostChange(false);
    setRequests(null);
    setOpen(false);
  }

  async function decide(id: string, action: "approve" | "reject") {
    setRequests((r) => r?.filter((x) => x.id !== id) ?? null);
    await fetch(`/api/admin/requests/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadRequests();
  }

  if (!open) {
    return (
      <p className="board__door">
        <button type="button" className="linklike" onClick={() => setOpen(true)}>
          Kaijsa
        </button>
      </p>
    );
  }

  if (!host) {
    return (
      <form className="board__host" onSubmit={signIn}>
        <p className="eyebrow">Kaijsa</p>
        <div className="board__say">
          <label className="sr-only" htmlFor="host-password">
            Password
          </label>
          <input
            id="host-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
          <button type="submit" className="btn" disabled={busy || !password}>
            {busy ? "…" : "In"}
          </button>
        </div>
        {error && <p className="board__notice">{error}</p>}
        <button type="button" className="linklike" onClick={() => setOpen(false)}>
          Never mind
        </button>
      </form>
    );
  }

  return (
    <div className="board__host">
      <p className="eyebrow">Asking to join</p>

      {requests === null && <p className="board__empty">Looking…</p>}
      {requests?.length === 0 && <p className="board__empty">Nobody waiting.</p>}

      {requests?.map((r) => (
        <div key={r.id} className="board__request">
          <div>
            <strong>{r.name}</strong>
            <span className="board__addr">{r.email}</span>
            {r.note && <em>{r.note}</em>}
          </div>
          <div className="board__decide">
            <button type="button" className="btn" onClick={() => decide(r.id, "approve")}>
              Let in
            </button>
            <button type="button" className="linklike" onClick={() => decide(r.id, "reject")}>
              No
            </button>
          </div>
        </div>
      ))}

      <p className="board__as">
        <button type="button" className="linklike" onClick={signOut}>
          Sign out
        </button>
      </p>
    </div>
  );
}
