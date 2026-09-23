import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">404</p>
        <h1>Nothing here</h1>
        <p>
          No page at this address. It may have been renamed, or it may never have
          existed — I am not always careful about the difference.
        </p>
      </header>
      <div style={{ display: "flex", gap: "1.6rem", flexWrap: "wrap" }}>
        <Link href="/" className="link-more">
          <span aria-hidden="true">←</span> Back to the front
        </Link>
        <Link href="/blog" className="link-more">
          The log <span aria-hidden="true">→</span>
        </Link>
        <Link href="/gallery" className="link-more">
          The gallery <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
