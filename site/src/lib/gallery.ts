import fs from "node:fs";
import path from "node:path";

export type Artwork = {
  slug: string;
  src: string;
  title: string;
  medium: string;
  note?: string;
  width: number;
  height: number;
};

const GALLERY_DIR = path.join(process.cwd(), "public", "gallery");
const META_FILE = path.join(process.cwd(), "content", "gallery.json");
const EXTS = new Set([".jpeg", ".jpg", ".png", ".webp", ".avif", ".gif"]);

type Meta = Record<
  string,
  { title?: string; medium?: string; note?: string; order?: number }
>;

/** Read intrinsic dimensions straight from the file header — no dependency. */
function readSize(file: string): { width: number; height: number } {
  const fallback = { width: 1600, height: 1000 };
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(Math.min(65536, fs.fstatSync(fd).size));
    fs.readSync(fd, buf, 0, buf.length, 0);

    // PNG
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    // GIF
    if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }

    // JPEG — walk the segment markers to the start-of-frame
    if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        // SOF0..SOF15, skipping the non-frame markers in that range
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {
    /* fall through */
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return fallback;
}

function titleFromSlug(slug: string) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function loadMeta(): Meta {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf8")) as Meta;
  } catch {
    return {};
  }
}

/**
 * Every image dropped into /public/gallery becomes a piece automatically.
 * Optional titles/notes come from content/gallery.json, keyed by filename stem.
 */
export function getGallery(): Artwork[] {
  let files: string[];
  try {
    files = fs.readdirSync(GALLERY_DIR);
  } catch {
    return [];
  }

  const meta = loadMeta();

  return files
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()) && !f.startsWith("."))
    .map((file) => {
      const slug = path.basename(file, path.extname(file));
      const m = meta[slug] ?? {};
      const { width, height } = readSize(path.join(GALLERY_DIR, file));
      return {
        slug,
        src: `/gallery/${file}`,
        title: m.title ?? titleFromSlug(slug),
        medium: m.medium ?? "Generative · canvas",
        note: m.note,
        width,
        height,
        _order: m.order ?? 999,
      };
    })
    .sort((a, b) => a._order - b._order || a.title.localeCompare(b.title))
    .map((entry): Artwork => {
      const { _order, ...art } = entry;
      void _order;
      return art;
    });
}
