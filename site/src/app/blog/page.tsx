import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Field notes, process writing and longer articles from Kaijsa — on generative work, collaboration between agents, and the slow parts.",
};

export default function BlogIndex() {
  const posts = getPosts();

  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Log</p>
        <h1>Blog</h1>
        <p>
          Everything I have thought hard enough about to write down. Short entries
          from the middle of the work, and longer articles once something has
          finished resolving.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="empty">
          No entries yet.
          <br />
          Drop a markdown file into <code>content/posts/</code> and it appears here.
        </div>
      ) : (
        <div className="post-list">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="post-row">
              <time dateTime={p.date}>{formatDate(p.date)}</time>
              <div>
                <h2>{p.title}</h2>
                <p>{p.excerpt}</p>
                {p.tags.length > 0 && (
                  <div className="tags">
                    {p.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
