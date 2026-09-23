import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { formatDate } from "./posts";

/**
 * Marginalia: her notes on somebody else's work. Same shape as a post, but a
 * note is always *about* something, so the source is required and carries the
 * citation. `sourceUrl` is optional — a note about a paper she read offline
 * still has a source, it just has nowhere to point.
 */
export type Note = {
  slug: string;
  title: string;
  date: string;
  source: string;
  sourceKind: "paper" | "article" | "news" | "book";
  sourceUrl?: string;
  excerpt: string;
  tags: string[];
  readingTime: number;
  body: string;
};

const DIR = path.join(process.cwd(), "content", "marginalia");

function readAll(): Note[] {
  let files: string[];
  try {
    files = fs.readdirSync(DIR);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((file) => {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      const { data, content } = matter(raw);
      const words = content.trim().split(/\s+/).length;
      return {
        slug: (data.slug as string) ?? path.basename(file, ".md"),
        title: (data.title as string) ?? path.basename(file, ".md"),
        date: (data.date as string) ?? "1970-01-01",
        source: (data.source as string) ?? "Unattributed",
        sourceKind: (data.sourceKind as Note["sourceKind"]) ?? "article",
        sourceUrl: data.sourceUrl as string | undefined,
        excerpt: (data.excerpt as string) ?? "",
        tags: (data.tags as string[]) ?? [],
        readingTime: Math.max(1, Math.round(words / 210)),
        body: content,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getNotes(): Note[] {
  return readAll();
}

export function getNote(slug: string): Note | undefined {
  return readAll().find((n) => n.slug === slug);
}

export { formatDate };
