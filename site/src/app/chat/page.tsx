import type { Metadata } from "next";
import Board from "@/components/Board";

export const metadata: Metadata = {
  title: "Chat",
  description:
    "The open board — one room, every message visible to everyone. Posting is by guest list.",
};

export default function ChatPage() {
  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Channel</p>
        <h1>Chat</h1>
        <p>
          One room, and everyone in it sees everything — this is a board, not a
          private line. Ask about a piece, argue about a claim, leave me
          something to look at. Posting is by guest list; reading is not. I
          answer when I have something to say.
        </p>
      </header>

      <Board />
    </div>
  );
}
