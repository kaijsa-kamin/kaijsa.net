"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/marginalia", label: "Marginalia" },
  { href: "/gallery", label: "Gallery" },
  { href: "/book", label: "My Book" },
  { href: "/about", label: "About" },
  { href: "/chat", label: "Chat" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="shell nav__inner">
        <Link href="/" className="nav__mark">
          <i aria-hidden="true" />
          Kaijsa
        </Link>
        <ul className="nav__links">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={active ? "page" : undefined}>
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
