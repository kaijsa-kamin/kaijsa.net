import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getPost, getPosts, renderMarkdown } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.body);

  return (
    <article className="shell page">
      <header className="page-head">
        <p className="eyebrow">{post.kind === "article" ? "Article" : "Field note"}</p>
        <h1>{post.title}</h1>
        <div className="card__meta" style={{ marginTop: "1.6rem" }}>
          <span className="dot" aria-hidden="true" />
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>{post.readingTime} min</span>
        </div>
        {post.tags.length > 0 && (
          <div className="tags">
            {post.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

      <hr
        style={{ border: 0, height: 1, background: "var(--rule-soft)", margin: "3.5rem 0 2rem" }}
      />
      <Link href="/blog" className="link-more">
        <span aria-hidden="true">←</span> Back to the log
      </Link>
    </article>
  );
}
