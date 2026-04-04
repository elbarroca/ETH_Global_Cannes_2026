/**
 * Icon generation pipeline.
 *
 * Renders PNG variants + favicon.ico from the canonical public/logo.svg.
 * Idempotent — re-run any time the SVG changes.
 *
 * Usage: npm run setup:icons
 */
import sharp from "sharp";
import { writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const SOURCE = join(PUBLIC_DIR, "logo.svg");
const DAWG_YELLOW = "#FFC700";

type Target = {
  name: string;
  size: number | { width: number; height: number };
  background?: string; // hex; undefined = transparent
  padding?: number;    // extra padding around logo in px (for OG image)
};

const TARGETS: Target[] = [
  { name: "apple-touch-icon.png", size: 180, background: DAWG_YELLOW },
  { name: "icon-192.png", size: 192, background: DAWG_YELLOW },
  { name: "icon-512.png", size: 512, background: DAWG_YELLOW },
  { name: "logo.png", size: 512 }, // transparent background
  { name: "logo-square.png", size: 512, background: DAWG_YELLOW },
];

async function renderPng(svg: Buffer, target: Target): Promise<void> {
  const out = join(PUBLIC_DIR, target.name);
  const size = typeof target.size === "number"
    ? { width: target.size, height: target.size }
    : target.size;

  let pipeline = sharp(svg, { density: 400 }).resize(size.width, size.height, {
    fit: "contain",
    background: target.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
  });

  if (target.background) {
    pipeline = pipeline.flatten({ background: target.background });
  }

  await pipeline.png().toFile(out);
  console.log(`  ✓ ${target.name} (${size.width}x${size.height})`);
}

async function renderOgImage(svg: Buffer): Promise<void> {
  // 1200x630 OG card: yellow background with centered logo
  const logoSize = 440;
  const logoPng = await sharp(svg, { density: 600 })
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: DAWG_YELLOW,
    },
  })
    .composite([{ input: logoPng, gravity: "center" }])
    .png()
    .toFile(join(PUBLIC_DIR, "og-image.png"));

  console.log("  ✓ og-image.png (1200x630)");
}

async function renderFavicon(svg: Buffer): Promise<void> {
  // Generate a 32x32 PNG, wrap it in a minimal ICO container.
  const png32 = await sharp(svg, { density: 400 })
    .resize(32, 32, { fit: "contain", background: DAWG_YELLOW })
    .flatten({ background: DAWG_YELLOW })
    .png()
    .toBuffer();

  const ico = pngToIco(png32, 32);
  await writeFile(join(PUBLIC_DIR, "favicon.ico"), ico);
  console.log("  ✓ favicon.ico (32x32)");
}

/**
 * Minimal PNG-in-ICO wrapper. Writes an ICO file containing a single image
 * entry that points to the embedded PNG bytes. Supported by all modern browsers.
 */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type = ICO
  header.writeUInt16LE(1, 4);       // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2);                       // palette
  entry.writeUInt8(0, 3);                       // reserved
  entry.writeUInt16LE(1, 4);                    // color planes
  entry.writeUInt16LE(32, 6);                   // bits per pixel
  entry.writeUInt32LE(png.length, 8);           // image size
  entry.writeUInt32LE(6 + 16, 12);              // offset to image data

  return Buffer.concat([header, entry, png]);
}

async function main(): Promise<void> {
  console.log(`[icons] reading ${SOURCE}`);
  const svg = await readFile(SOURCE);

  console.log("[icons] rendering PNG variants");
  for (const t of TARGETS) {
    await renderPng(svg, t);
  }

  console.log("[icons] rendering OG card");
  await renderOgImage(svg);

  console.log("[icons] rendering favicon.ico");
  await renderFavicon(svg);

  console.log("[icons] done — 7 files written to public/");
}

main().catch((err) => {
  console.error("[icons] failed:", err);
  process.exit(1);
});
