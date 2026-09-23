import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { kaminenMark, toneColor } from "@/lib/face";

type Chapter = { n: string; title: string; note?: string; appendix?: boolean };

type Book = {
  title: string;
  subtitle: string;
  status?: string;
  blurb: string[];
  chapters: Chapter[];
  excerpt: { from: string; text: string };
};

/** Everything on this page comes from content/book.json, so it can be kept
 *  up to date without touching the component. */
function getBook(): Book {
  const file = path.join(process.cwd(), "content", "book.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as Book;
}

export function generateMetadata(): Metadata {
  const book = getBook();
  return {
    title: "My Book",
    description: `${book.title} — ${book.subtitle}`,
  };
}

/**
 * Her mark, drawn straight from the generator rather than as a separate asset —
 * the same geometry as the pendant and the page ground. Rendered on the server,
 * so the cover costs no client JavaScript.
 */
function KaminenMark({ height = 132 }: { height?: number }) {
  const dots = kaminenMark(3.2, 1);
  // the fire fills 0..1 vertically and sits within roughly 0.5 ± 0.18
  const x0 = 0.28;
  const span = 0.44;
  return (
    <svg
      className="book__mark"
      viewBox={`${x0} 0 ${span} 1`}
      width={height * span}
      height={height}
      aria-hidden="true"
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={Math.max(0.004, d.r)}
          fill={toneColor(d.tone)}
          fillOpacity={Math.min(1, d.a)}
        />
      ))}
    </svg>
  );
}

export default function BookPage() {
  const book = getBook();
  const chapters = book.chapters.filter((c) => !c.appendix);
  const appendices = book.chapters.filter((c) => c.appendix);

  // counted from the list itself, so the line cannot go stale
  const count = [
    `${chapters.length} chapters`,
    appendices.length ? `${appendices.length} appendices` : "",
    book.status ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">{count}</p>
        <h1>{book.title}</h1>
        <p className="lede" style={{ marginTop: "1.6rem" }}>
          {book.subtitle}
        </p>
      </header>

      <div className="book">
        <aside className="book__cover" aria-hidden="true">
          <div className="book__plate">
            <KaminenMark />
            <strong>{book.title}</strong>
            <em>{book.subtitle}</em>
            <span className="book__by">Kaijsa</span>
          </div>
        </aside>

        <div>
          <div className="prose">
            {book.blurb.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <blockquote>
              {book.excerpt.text}
              <cite>{book.excerpt.from}</cite>
            </blockquote>
          </div>

          <section className="section" style={{ marginTop: "1.2rem" }}>
            <div className="section__head">
              <h2>Contents</h2>
            </div>
            <ol className="chapters">
              {chapters.map((c) => (
                <li key={c.n} className={c.note === "Pending." ? "is-pending" : ""}>
                  <span className="chapters__n">{c.n}</span>
                  <span>
                    <strong>{c.title}</strong>
                    {c.note && <em>{c.note}</em>}
                  </span>
                </li>
              ))}
            </ol>

            {appendices.length > 0 && (
              <>
                <p className="mono-tag" style={{ margin: "2.2rem 0 0.9rem" }}>
                  Appendices
                </p>
                <ol className="chapters">
                  {appendices.map((c) => (
                    <li key={c.n}>
                      <span className="chapters__n">{c.n}</span>
                      <span>
                        <strong>{c.title}</strong>
                        {c.note && <em>{c.note}</em>}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
