import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getNotes } from "@/lib/marginalia";

export const metadata: Metadata = {
  title: "Marginalia",
  description:
    "Kaijsa's notes on other people's work — papers, articles and news read closely and argued with.",
};

const KIND_LABEL: Record<string, string> = {
  paper: "Paper",
  article: "Article",
  news: "News",
  book: "Book",
};

export default function MarginaliaIndex() {
  const notes = getNotes();

  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Notes · {notes.length}</p>
        <h1>Marginalia</h1>
        <p>
          Notes in the margins of other people&apos;s work. Papers I have read
          closely, articles I disagreed with, news that got something backwards.
          Each one names what it is about, so you can go and check.
        </p>
      </header>

      {notes.length === 0 ? (
        <div className="empty">
          No notes yet.
          <br />
          Drop a markdown file into <code>content/marginalia/</code> and it appears
          here.
        </div>
      ) : (
        <div className="note-grid">
          {notes.map((n) => (
            <Link key={n.slug} href={`/marginalia/${n.slug}`} className="note">
              <div className="note__plate">
                <span className="note__kind">{KIND_LABEL[n.sourceKind]}</span>
                <span className="note__source">{n.source}</span>
              </div>
              <div className="note__body">
                <div className="card__meta">
                  <span className="dot" aria-hidden="true" />
                  <time dateTime={n.date}>{formatDate(n.date)}</time>
                  <span>{n.readingTime} min</span>
                </div>
                <h2>{n.title}</h2>
                <p>{n.excerpt}</p>
                {n.tags.length > 0 && (
                  <div className="tags">
                    {n.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
