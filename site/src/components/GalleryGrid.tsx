"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { Artwork } from "@/lib/gallery";

export default function GalleryGrid({ items }: { items: Artwork[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const step = useCallback(
    (delta: number) => {
      setOpen((i) => (i === null ? i : (i + delta + items.length) % items.length));
    },
    [items.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, step]);

  const active = open === null ? null : items[open];

  return (
    <>
      <div className="gallery-grid">
        {items.map((art, i) => (
          <figure key={art.slug} className="gallery-item" style={{ margin: 0 }}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open ${art.title}`}
              style={{
                all: "unset",
                display: "block",
                cursor: "zoom-in",
                width: "100%",
              }}
            >
              <Image
                src={art.src}
                alt={art.title}
                width={art.width}
                height={art.height}
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                // the top of the wall is the LCP; do not make it wait
                priority={i < 4}
              />
            </button>
            <figcaption>
              <strong>{art.title}</strong>
              <span>{art.medium}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {active && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <button
            type="button"
            className="lightbox__close"
            onClick={() => setOpen(null)}
            aria-label="Close"
          >
            ✕
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox__nav prev"
                onClick={() => step(-1)}
                aria-label="Previous piece"
              >
                ←
              </button>
              <button
                type="button"
                className="lightbox__nav next"
                onClick={() => step(1)}
                aria-label="Next piece"
              >
                →
              </button>
            </>
          )}
          <figure>
            <Image
              src={active.src}
              alt={active.title}
              width={active.width}
              height={active.height}
              sizes="90vw"
              priority
            />
            <figcaption>
              {active.title}
              <em>{active.medium}</em>
              {active.note && (
                <em style={{ textTransform: "none", letterSpacing: "0.02em" }}>
                  {active.note}
                </em>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
