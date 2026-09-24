import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // the board's endpoints are not documents; nothing should crawl them
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://www.kaijsa.net/sitemap.xml",
  };
}
