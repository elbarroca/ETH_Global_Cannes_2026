/**
 * Icon generation pipeline.
 *
 * Canonical source: public/logo-source.png — the exact AlphaDawg brand mark
 * (612×612 raster). All icon variants are resized from this single file so
 * every surface shows the identical logo. Idempotent: safe to re-run whenever
 * the source changes.
 *
 * Usage: npm run setup:icons
 */
import sharp from "sharp";
import { writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const APP_DIR = join(__dirname, "..", "app");
const SOURCE = join(PUBLIC_DIR, "logo-source.png");
const DAWG_YELLOW = "#FFC700";

type Target = {
  name: string;
  dir: "public" | "app";
  size: number;
};

const TARGETS: Target[] = [
  // Canonical brand copies in public/
  { name: "logo.png", dir: "public", size: 612 },        // identical copy of source
  { name: "logo-square.png", dir: "public", size: 512 },
  { name: "apple-touch-icon.png", dir: "public", size: 180 },
  { name: "icon-192.png", dir: "public", size: 192 },
  { name: "icon-512.png", dir: "public", size: 512 },
];

async function renderPng(source: Buffer, target: Target): Promise<void> {
  const baseDir = target.dir === "public" ? PUBLIC_DIR : APP_DIR;
  const out = join(baseDir, target.name);

  await sharp(source)
    .resize(target.size, target.size, {
      fit: "contain",
      background: DAWG_YELLOW,
    })
    .flatten({ background: DAWG_YELLOW })
    .png()
    .toFile(out);

  console.log(`  ✓ ${target.dir}/${target.name} (${target.size}x${target.size})`);
}

async function renderOgImage(source: Buffer): Promise<void> {
  // 1200x630 social card: yellow background with the dawg logo centered
  const logoSize = 500;
  const logoPng = await sharp(source)
    .resize(logoSize, logoSize, { fit: "contain", background: DAWG_YELLOW })
    .flatten({ background: DAWG_YELLOW })
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

  console.log("  ✓ public/og-image.png (1200x630)");
}

async function renderFavicon(source: Buffer): Promise<void> {
  const png32 = await sharp(source)
    .resize(32, 32, { fit: "contain", background: DAWG_YELLOW })
    .flatten({ background: DAWG_YELLOW })
    .png()
    .toBuffer();

  const ico = pngToIco(png32, 32);
  await writeFile(join(PUBLIC_DIR, "favicon.ico"), ico);
  console.log("  ✓ public/favicon.ico (32x32)");
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
  const source = await readFile(SOURCE);

  console.log("[icons] rendering size variants");
  for (const t of TARGETS) {
    await renderPng(source, t);
  }

  console.log("[icons] rendering OG card");
  await renderOgImage(source);

  console.log("[icons] rendering favicon.ico");
  await renderFavicon(source);

  console.log("[icons] done");
}

main().catch((err) => {
  console.error("[icons] failed:", err);
  process.exit(1);
});
