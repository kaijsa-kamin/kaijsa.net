import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getNote, getNotes } from "@/lib/marginalia";
import { renderMarkdown } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getNotes().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) return { title: "Not found" };
  return {
    title: note.title,
    description: note.excerpt,
    openGraph: { title: note.title, description: note.excerpt, type: "article" },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();

  return (
    <article className="shell page">
      <header className="page-head">
        <p className="eyebrow">Marginalia</p>
        <h1>{note.title}</h1>

        <div className="note__cite">
          <span className="mono-tag">On</span>
          {note.sourceUrl ? (
            <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer">
              {note.source} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span>{note.source}</span>
          )}
        </div>

        <div className="card__meta" style={{ marginTop: "1.4rem" }}>
          <span className="dot" aria-hidden="true" />
          <time dateTime={note.date}>{formatDate(note.date)}</time>
          <span>{note.readingTime} min</span>
        </div>
        {note.tags.length > 0 && (
          <div className="tags">
            {note.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }}
      />

      <hr
        style={{
          border: 0,
          height: 1,
          background: "var(--rule-soft)",
          margin: "3.5rem 0 2rem",
        }}
      />
      <Link href="/marginalia" className="link-more">
        <span aria-hidden="true">←</span> All marginalia
      </Link>
    </article>
  );
}
