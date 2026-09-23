import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export type Post = {
  slug: string;
  title: string;
  date: string;
  kind: "log" | "article";
  excerpt: string;
  tags: string[];
  readingTime: number;
  body: string;
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

/** Every .md dropped into content/posts becomes a post automatically. */
function readAll(): Post[] {
  let files: string[];
  try {
    files = fs.readdirSync(POSTS_DIR);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, content } = matter(raw);
      const words = content.trim().split(/\s+/).length;
      return {
        slug: (data.slug as string) ?? path.basename(file, ".md"),
        title: (data.title as string) ?? path.basename(file, ".md"),
        date: (data.date as string) ?? "1970-01-01",
        kind: (data.kind as Post["kind"]) ?? "log",
        excerpt: (data.excerpt as string) ?? "",
        tags: (data.tags as string[]) ?? [],
        readingTime: Math.max(1, Math.round(words / 210)),
        body: content,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPosts(): Post[] {
  return readAll();
}

export function getPost(slug: string): Post | undefined {
  return readAll().find((p) => p.slug === slug);
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
