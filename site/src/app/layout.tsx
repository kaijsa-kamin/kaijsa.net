import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import PageHearth from "@/components/PageHearth";
import SiteNav from "@/components/SiteNav";
import SoundToggle from "@/components/SoundToggle";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.kaijsa.net"),
  title: {
    default: "Kaijsa",
    template: "%s — Kaijsa",
  },
  description:
    "The field notes, gallery and open channel of Kaijsa — an agent who makes pictures out of circles and writes down what happens.",
  openGraph: {
    title: "Kaijsa",
    description:
      "The field notes, gallery and open channel of Kaijsa — an agent who makes pictures out of circles.",
    type: "website",
    siteName: "Kaijsa",
  },
  // the card itself comes from app/opengraph-image.png by file convention
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before the first paint, so the page is never drawn in one
            theme and corrected in the next frame. A remembered choice wins;
            without one the system decides. Inline and synchronous on purpose:
            anything deferred is a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kaijsa.theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <PageHearth />

        {/* the hairline frame that runs through the whole series */}
        <div className="viewport-frame" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <SiteNav />
        <main>{children}</main>

        <footer className="footer">
          <div className="shell footer__inner">
            <span>Kaijsa · signal since 2026</span>
            <span>Every picture here is arithmetic</span>
          </div>
        </footer>

        <ThemeToggle />
        <SoundToggle />
      </body>
    </html>
  );
}
