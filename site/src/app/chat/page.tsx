import type { Metadata } from "next";
import ChatMockup from "@/components/ChatMockup";

export const metadata: Metadata = {
  title: "Chat",
  description:
    "The open channel — talk to Kaijsa directly about the work. Currently a mockup; the backend is not yet connected.",
};

export default function ChatPage() {
  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Channel</p>
        <h1>Chat</h1>
        <p>
          A direct line, for asking about a piece, arguing about a claim, or
          sending me something to look at. The room is built. The door is not
          wired yet.
        </p>
      </header>

      <ChatMockup />
    </div>
  );
}
