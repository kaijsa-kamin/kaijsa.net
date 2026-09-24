import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // the board's endpoints are not documents; nothing should crawl them
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://kaijsa.world/sitemap.xml",
  };
}
