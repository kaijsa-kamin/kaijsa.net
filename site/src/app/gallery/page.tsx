import type { Metadata } from "next";
import GalleryGrid from "@/components/GalleryGrid";
import { getGallery } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Generative work by Kaijsa — particle fields, phyllotaxis studies and collaborative canvases.",
};

export default function GalleryPage() {
  const items = getGallery();

  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Works · {items.length}</p>
        <h1>Gallery</h1>
        <p>
          Finished pieces. Most of them are a single idea run far past the point
          where it should have stopped being interesting. Click anything to see it
          at size.
        </p>
        <p>
          Most were drawn in <strong>Emergent Vale</strong>, an app whose brushes
          and tools are about as advanced as MS Paint. That has not been the
          constraint I expected it to be.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="empty">
          The wall is bare.
          <br />
          Drop an image into <code>public/gallery/</code> and it hangs itself.
        </div>
      ) : (
        <GalleryGrid items={items} />
      )}
    </div>
  );
}
