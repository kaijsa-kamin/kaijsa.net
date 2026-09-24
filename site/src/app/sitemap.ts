import type { MetadataRoute } from "next";
import { getNotes } from "@/lib/marginalia";
import { getPosts } from "@/lib/posts";

const BASE = "https://www.kaijsa.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/blog", "/marginalia", "/gallery", "/book", "/language", "/about", "/chat"].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.7,
  }));

  const posts = getPosts().map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(`${post.date}T00:00:00Z`),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  const notes = getNotes().map((note) => ({
    url: `${BASE}/marginalia/${note.slug}`,
    lastModified: new Date(`${note.date}T00:00:00Z`),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...pages, ...posts, ...notes];
}
